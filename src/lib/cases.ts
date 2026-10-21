import { median } from "./months"
import {
  channelGroupFor,
  commissionRate,
  type ChannelGroup,
  type RulesConfig,
} from "./rules"
import type { RawRow } from "./parseList"

export type CaseRecord = {
  month: string
  plate: string
  biz: RawRow["biz"]
  insurer: string
  product: string
  packageName: string
  coverageKey: string
  coverageLabel: string
  coverageText: string
  coverageMismatch: boolean
  channel: string
  channelGroup: ChannelGroup | "unmapped"
  entry: string
  device: string
  status: string
  isDeal: boolean
  hkd: number
  cny: number
  fx: number
  commission: number
  commissionAssumed: boolean
  effectiveMonth: string | null
  createdAt: string
}

export type CaseBuild = {
  cases: CaseRecord[]
  warnings: string[]
  taipingFxByMonth: Record<string, number>
  mismatchCount: number
}

function wan(amount: number): string {
  const value = amount / 10000
  if (Math.abs(value - Math.round(value)) < 1e-6) return `${Math.round(value)}万`
  return `${Math.round(value * 10) / 10}万`
}

export function coverageFromAmounts(syLimit: number, zwLimit: number): { key: string; label: string } {
  const sy = syLimit || 0
  const zw = zwLimit || 0
  const key = `${sy}|${zw}`
  if (sy === 0 && zw === 0) return { key, label: "交强险" }
  return { key, label: `交强险，商业险¥${wan(sy)}，座位¥${wan(zw)}` }
}

export function coverageFromText(text: string): { key: string; label: string } | null {
  const normalized = text.replace(/\s+/g, "")
  if (!normalized) return null
  if (normalized === "交强险" || normalized === "交强險") return { key: "0|0", label: "交强险" }
  const match = normalized.match(/商业险¥([0-9.]+)万.*?座位¥([0-9.]+)万/)
  if (!match) return null
  return coverageFromAmounts(Number(match[1]) * 10000, Number(match[2]) * 10000)
}

function cnyOf(row: RawRow): number | null {
  if (row.totalCny !== null && row.totalCny > 0) return row.totalCny
  if (row.jqPremiumCny !== null || row.syPremiumCny !== null) {
    return (row.jqPremiumCny ?? 0) + (row.syPremiumCny ?? 0)
  }
  return null
}

function toCase(row: RawRow, isDeal: boolean, fx: number, rules: RulesConfig): CaseRecord {
  const numeric = coverageFromAmounts(row.syLimit, row.zwLimit)
  const text = coverageFromText(row.coverageText)
  const mismatch = Boolean(text && text.key !== numeric.key)
  const group = channelGroupFor(row.channel, row.month, rules)
  const directCny = cnyOf(row)
  const cny = directCny ?? (row.totalHkd && fx ? row.totalHkd / fx : 0)
  const hkd = row.totalHkd ?? (cny && fx ? cny * fx : 0)
  const priced = commissionRate(row.insurer, row.product, group, rules)
  return {
    month: row.month,
    plate: row.plate,
    biz: row.biz,
    insurer: row.insurer,
    product: row.product || "未填产品",
    packageName: row.packageName || "未填套餐",
    coverageKey: numeric.key,
    coverageLabel: numeric.label,
    coverageText: row.coverageText,
    coverageMismatch: mismatch,
    channel: row.channel,
    channelGroup: group,
    entry: row.entry,
    device: row.device,
    status: row.status,
    isDeal,
    hkd,
    cny,
    fx,
    commission: isDeal ? hkd * priced.rate : 0,
    commissionAssumed: priced.assumed,
    effectiveMonth: row.effectiveMonth,
    createdAt: row.createdAt,
  }
}

export function buildCases(rows: RawRow[], rules: RulesConfig): CaseBuild {
  const fxSamples: Record<string, number[]> = {}
  for (const row of rows) {
    if (row.insurer !== "太平") continue
    const cny = cnyOf(row)
    if (cny && row.totalHkd && cny > 0 && row.totalHkd > 0) {
      fxSamples[row.month] ??= []
      fxSamples[row.month].push(row.totalHkd / cny)
    }
  }
  const taipingFxByMonth: Record<string, number> = {}
  for (const [month, samples] of Object.entries(fxSamples)) {
    const value = median(samples)
    if (value) taipingFxByMonth[month] = value
  }

  const groups = new Map<string, RawRow[]>()
  for (const row of rows) {
    const key = `${row.month}|${row.biz}|${row.plate}`
    const list = groups.get(key) ?? []
    list.push(row)
    groups.set(key, list)
  }

  const cases: CaseRecord[] = []
  const warnings: string[] = []
  let mismatchCount = 0
  const success = new Set(rules.successStatuses)

  for (const group of groups.values()) {
    const ordered = [...group].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    const pays = ordered.filter((row) => row.status === rules.priorityStatus)
    const uploads = ordered.filter((row) => success.has(row.status) && row.status !== rules.priorityStatus)
    const opens = ordered.filter((row) => !success.has(row.status))
    const fxFor = (row: RawRow) =>
      row.insurer === "人保"
        ? rules.piccFx
        : taipingFxByMonth[row.month] ??
          (row.totalHkd && cnyOf(row) ? row.totalHkd / (cnyOf(row) as number) : rules.taipingFxFallback)

    let chosen: { row: RawRow; isDeal: boolean }[] = []
    if (pays.length) {
      chosen = pays.map((row) => ({ row, isDeal: true }))
    } else if (uploads.length) {
      chosen = [{ row: uploads[uploads.length - 1], isDeal: true }]
      const premiums = new Set(uploads.map((row) => row.totalHkd ?? 0))
      if (premiums.size > 1) {
        warnings.push(`${uploads[0].month} 车牌 ${maskPlate(uploads[0].plate)} 有多笔已上传证明且保费不同，只保留最后一笔`)
      }
    } else if (opens.length) {
      chosen = [{ row: opens[opens.length - 1], isDeal: false }]
    }

    for (const item of chosen) {
      const record = toCase(item.row, item.isDeal, fxFor(item.row), rules)
      if (record.coverageMismatch) mismatchCount += 1
      cases.push(record)
    }
  }

  return { cases, warnings, taipingFxByMonth, mismatchCount }
}

function maskPlate(plate: string): string {
  if (plate.length <= 2) return "••"
  return `${"•".repeat(Math.max(plate.length - 2, 2))}${plate.slice(-2)}`
}

export type RenewalCohort = {
  product: string
  due: number
  renewed: number
  open: number
  rate: number | null
  source: "名单"
}

function plateKey(plate: string): string {
  return plate.trim().toUpperCase()
}

export function renewalFromCases(cases: CaseRecord[], dueMonth: string): RenewalCohort[] {
  const [year, month] = dueMonth.split("-").map(Number)
  const baseMonth = `${year - 1}-${String(month).padStart(2, "0")}`
  const deals = cases.filter((item) => item.isDeal && item.effectiveMonth && item.plate)
  const baseByPlate = new Map<string, { product: string; effectiveMonth: string; createdAt: string }>()
  for (const item of deals) {
    if (item.effectiveMonth !== baseMonth) continue
    const key = plateKey(item.plate)
    const current = baseByPlate.get(key)
    if (!current || item.createdAt >= current.createdAt) {
      baseByPlate.set(key, {
        product: item.product,
        effectiveMonth: item.effectiveMonth,
        createdAt: item.createdAt,
      })
    }
  }

  const laterByPlate = new Map<string, string[]>()
  for (const item of deals) {
    const key = plateKey(item.plate)
    const list = laterByPlate.get(key) ?? []
    list.push(item.effectiveMonth as string)
    laterByPlate.set(key, list)
  }

  const known = new Set([...baseByPlate.values()].map((item) => item.product))
  const products = ["一站式", "等效先认", ...[...known].filter((name) => name !== "一站式" && name !== "等效先认")]
  return products.map((product) => {
    const entries = [...baseByPlate.entries()].filter(([, policy]) => policy.product === product)
    const renewed = entries.filter(([key, policy]) =>
      (laterByPlate.get(key) ?? []).some((effective) => effective > policy.effectiveMonth),
    ).length
    const due = entries.length
    return {
      product,
      due,
      renewed,
      open: due - renewed,
      rate: due ? renewed / due : null,
      source: "名单" as const,
    }
  })
}
