import type { RawRow } from "./parseList"
import type { ReportMonth } from "./parseSalesReport"
import type { SocialBlock } from "./parseSocial"
import type { SupplementMonth } from "./parseSupplement"
import type { FileChip } from "./view"
import { monthLabel } from "./months"

export type StagedFile = {
  id: string
  slot: string
  name: string
  filename: string
  bytes?: ArrayBuffer
  summary: string
  warnings: string[]
  rows?: RawRow[]
  report?: Record<string, ReportMonth>
  supplement?: Record<string, SupplementMonth>
  social?: SocialBlock[]
  actionLine?: string
  metrics: Record<string, number>
  listKeys: { orderId: string; status: string; hkd: number | null; fileTag: string }[]
}

export type ConflictOption = {
  id: string
  source: string
  display: string
  value?: number
  fileTag?: string
}

export type Conflict = {
  kind: "metric" | "list"
  id: string
  label: string
  key: string
  orderId?: string
  options: ConflictOption[]
}

const FIELD_LABEL: Record<string, string> = {
  motor: "验车数",
  inquiries: "咨询量",
  nbSales: "新增成交",
  rnSales: "续保成交",
  nbApplication: "新增申请",
  rnApplication: "续保申请",
  premiumNb: "新增保费",
  premiumRn: "续保保费",
  premiumTotal: "港币保费",
  "sem.impression": "SEM 曝光",
  "sem.clicks": "SEM 点击",
  "sem.cost": "SEM 花费",
  "sem.conversion": "SEM 转化",
  "fb.impression": "Facebook 曝光",
  "fb.clicks": "Facebook 点击",
  "fb.cost": "Facebook 花费",
  "fb.conversion": "Facebook 转化",
  oneStopDue: "一站式应续保",
  oneStopRenewed: "一站式已续保",
  oneStopOpen: "一站式未续保",
}

const SUPPLEMENT_FIELD: Record<string, string> = {
  motor: "motor",
  inquiries: "inquiries",
  sem_impression: "sem.impression",
  sem_clicks: "sem.clicks",
  sem_cost: "sem.cost",
  sem_conversion: "sem.conversion",
  sem_ctr: "sem.ctr",
  sem_cpc: "sem.cpc",
  sem_cpa: "sem.cpa",
  fb_impression: "fb.impression",
  fb_clicks: "fb.clicks",
  fb_cost: "fb.cost",
  fb_conversion: "fb.conversion",
  fb_ctr: "fb.ctr",
  fb_cpc: "fb.cpc",
  fb_cpa: "fb.cpa",
  due_onestop: "oneStopDue",
  renewed_onestop: "oneStopRenewed",
  open_onestop: "oneStopOpen",
}

function put(target: Record<string, number>, key: string, value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return
  target[key] = value
}

export function metricsFromReport(report: Record<string, ReportMonth>): Record<string, number> {
  const metrics: Record<string, number> = {}
  for (const month of Object.values(report)) {
    const fields: [string, number | null][] = [
      ["motor", month.motor],
      ["inquiries", month.inquiries],
      ["nbSales", month.nbSales],
      ["rnSales", month.rnSales],
      ["nbApplication", month.nbApplication],
      ["rnApplication", month.rnApplication],
      ["premiumNb", month.premiumNb],
      ["premiumRn", month.premiumRn],
      ["premiumTotal", month.premiumTotal],
      ["sem.impression", month.sem.impression ?? null],
      ["sem.clicks", month.sem.clicks ?? null],
      ["sem.cost", month.sem.cost ?? null],
      ["sem.conversion", month.sem.conversion ?? null],
      ["fb.impression", month.fb.impression ?? null],
      ["fb.clicks", month.fb.clicks ?? null],
      ["fb.cost", month.fb.cost ?? null],
      ["fb.conversion", month.fb.conversion ?? null],
      ["oneStopDue", month.oneStopDue],
      ["oneStopRenewed", month.oneStopRenewed],
      ["oneStopOpen", month.oneStopOpen],
    ]
    for (const [field, value] of fields) put(metrics, `${month.month}|${field}`, value)
  }
  return metrics
}

export function metricsFromSupplement(months: Record<string, SupplementMonth>): Record<string, number> {
  const metrics: Record<string, number> = {}
  for (const [month, values] of Object.entries(months)) {
    for (const [key, value] of Object.entries(values)) {
      const field = SUPPLEMENT_FIELD[key]
      if (field) put(metrics, `${month}|${field}`, value)
    }
  }
  return metrics
}

export function metricsFromSocial(blocks: SocialBlock[]): Record<string, number> {
  const metrics: Record<string, number> = {}
  for (const block of blocks) {
    for (const [metric, series] of Object.entries(block.series)) {
      for (const [month, value] of Object.entries(series)) {
        put(metrics, `social|${block.title}|${metric}|${month}`, value)
      }
    }
  }
  return metrics
}

function differs(left: number, right: number): boolean {
  return Math.abs(left - right) > 0.5
}

function formatValue(key: string, value: number): string {
  const field = key.includes("|") ? key.split("|").slice(1).join("|") : key
  if (field.toLowerCase().includes("premium") || field.endsWith("cost") || field.endsWith("cpc") || field.endsWith("cpa")) {
    return `HK$${Math.round(value).toLocaleString("zh-HK")}`
  }
  if (Number.isInteger(value)) return value.toLocaleString("zh-HK")
  return value.toLocaleString("zh-HK", { maximumFractionDigits: 2 })
}

function metricLabel(key: string): string {
  if (key.startsWith("social|")) {
    const [, title, metric, month] = key.split("|")
    return `${monthLabel(month)} ${title} ${metric}`
  }
  const [month, field] = [key.slice(0, 7), key.slice(8)]
  return `${monthLabel(month)} ${FIELD_LABEL[field] ?? field}`
}

export function detectConflicts(staged: StagedFile[]): Conflict[] {
  const conflicts: Conflict[] = []
  const owners = new Map<string, { id: string; source: string; value: number }[]>()
  for (const file of staged) {
    for (const [key, value] of Object.entries(file.metrics)) {
      const list = owners.get(key) ?? []
      if (list.some((item) => item.id === file.id)) continue
      list.push({ id: file.id, source: file.name, value })
      owners.set(key, list)
    }
  }
  for (const [key, list] of owners) {
    const distinct = list.filter((item, index) => list.findIndex((other) => !differs(other.value, item.value)) === index)
    if (list.length < 2 || distinct.length < 2) continue
    conflicts.push({
      kind: "metric",
      id: `metric|${key}`,
      key,
      label: metricLabel(key),
      options: list.map((item) => ({
        id: item.id,
        source: item.source,
        display: formatValue(key, item.value),
        value: item.value,
      })),
    })
  }

  const byOrder = new Map<string, { id: string; source: string; status: string; hkd: number | null; fileTag: string }[]>()
  for (const file of staged) {
    for (const item of file.listKeys) {
      if (!item.orderId) continue
      const list = byOrder.get(item.orderId) ?? []
      list.push({ id: file.id, source: file.name, status: item.status, hkd: item.hkd, fileTag: item.fileTag })
      byOrder.set(item.orderId, list)
    }
  }
  for (const [orderId, list] of byOrder) {
    const files = new Set(list.map((item) => item.id))
    if (files.size < 2) continue
    const same = list.every((item) => item.status === list[0].status && !differs(item.hkd ?? 0, list[0].hkd ?? 0))
    if (same) continue
    conflicts.push({
      kind: "list",
      id: `list|${orderId}`,
      key: orderId,
      orderId,
      label: `订单 ${orderId}`,
      options: [...files].map((id) => {
        const item = list.find((row) => row.id === id)!
        const money = item.hkd === null ? "保费空" : `HK$${Math.round(item.hkd).toLocaleString("zh-HK")}`
        return { id, source: item.source, display: `${item.status} · ${money}`, fileTag: item.fileTag }
      }),
    })
  }
  return conflicts
}

function writeMetric(
  report: Record<string, ReportMonth>,
  supplement: Record<string, SupplementMonth>,
  key: string,
  value: number,
) {
  if (key.startsWith("social|")) return
  const month = key.slice(0, 7)
  const field = key.slice(8)
  const row = report[month]
  if (row) {
    if (field.startsWith("sem.")) row.sem[field.slice(4)] = value
    else if (field.startsWith("fb.")) row.fb[field.slice(3)] = value
    else if (field === "oneStopDue") row.oneStopDue = value
    else if (field === "oneStopRenewed") row.oneStopRenewed = value
    else if (field === "oneStopOpen") row.oneStopOpen = value
    else (row as unknown as Record<string, number | null>)[field] = value
  }
  const supplementKey = Object.entries(SUPPLEMENT_FIELD).find(([, mapped]) => mapped === field)?.[0]
  if (supplementKey && supplementKey !== "due_onestop" && supplementKey !== "renewed_onestop" && supplementKey !== "open_onestop") {
    supplement[month] ??= {}
    supplement[month][supplementKey] = value
  }
}

export type AppliedBundle = {
  rows: RawRow[]
  report: Record<string, ReportMonth>
  supplement: Record<string, SupplementMonth>
  social: SocialBlock[]
  actionLine: string
  warnings: string[]
  files: FileChip[]
}

function rowKey(row: RawRow) {
  return `${row.slot}|${row.serial}|${row.orderId}|${row.status}|${row.month}|${row.plate}|${row.biz}`
}

export function coveredMonths(item: StagedFile): string[] {
  const months = new Set<string>()
  for (const [month, row] of Object.entries(item.report ?? {})) {
    if (row.oneStopDue !== null || row.nbSales !== null || row.totalSales !== null || row.premiumTotal !== null || row.motor !== null) {
      months.add(month)
    }
  }
  for (const [month, values] of Object.entries(item.supplement ?? {})) {
    if (Object.keys(values).length) months.add(month)
  }
  for (const block of item.social ?? []) {
    for (const series of Object.values(block.series)) {
      for (const [month, value] of Object.entries(series)) {
        if (value !== null && value !== undefined) months.add(month)
      }
    }
  }
  for (const row of item.rows ?? []) if (row.month) months.add(row.month)
  if (item.actionLine) months.add("*")
  return [...months].sort()
}

export function applyStaged(
  base: AppliedBundle,
  staged: StagedFile[],
  conflicts: Conflict[],
  choices: Record<string, string>,
): AppliedBundle {
  const next: AppliedBundle = {
    rows: [...base.rows],
    report: structuredClone(base.report),
    supplement: structuredClone(base.supplement),
    social: structuredClone(base.social),
    actionLine: base.actionLine,
    warnings: [...base.warnings],
    files: [...base.files],
  }
  for (const item of staged) {
    if (item.rows) {
      const map = new Map(next.rows.map((row) => [`${row.sourceFile}|${rowKey(row)}`, row]))
      for (const row of item.rows) map.set(`${row.sourceFile}|${rowKey(row)}`, row)
      next.rows = [...map.values()]
    }
    if (item.report) next.report = { ...next.report, ...structuredClone(item.report) }
    if (item.supplement) {
      for (const [month, values] of Object.entries(item.supplement)) {
        next.supplement[month] = { ...next.supplement[month], ...values }
      }
    }
    if (item.social) next.social = structuredClone(item.social)
    if (item.actionLine) next.actionLine = item.actionLine
    next.warnings.push(...item.warnings)
    next.files = [
      ...next.files.filter((file) => !(file.slot === item.slot && file.name === item.name)),
      {
        slot: item.slot,
        name: item.name,
        filename: item.filename,
        detail: item.summary,
        months: coveredMonths(item),
        bytes: item.bytes,
      },
    ]
  }
  const actionLines = staged.map((item) => item.actionLine).filter((line): line is string => Boolean(line))
  if (actionLines.length > 1) {
    const body = actionLines.map((line) => line.replace(/^本月行动：/, "").replace(/。$/, "")).join("，")
    next.actionLine = `本月行动：${body.slice(0, 88)}${body.length > 88 ? "…" : ""}。`
  }
  for (const conflict of conflicts) {
    const chosen = conflict.options.find((option) => option.id === choices[conflict.id]) ?? conflict.options[0]
    if (!chosen) continue
    if (conflict.kind === "metric" && chosen.value !== undefined) {
      if (conflict.key.startsWith("social|")) {
        const [, title, metric, month] = conflict.key.split("|")
        const block = next.social.find((item) => item.title === title)
        if (block) {
          block.series[metric] ??= {}
          block.series[metric][month] = chosen.value
        }
      } else {
        writeMetric(next.report, next.supplement, conflict.key, chosen.value)
      }
    }
    if (conflict.kind === "list" && conflict.orderId && chosen.fileTag) {
      next.rows = next.rows.filter((row) => row.orderId !== conflict.orderId || row.sourceFile === chosen.fileTag)
    }
  }
  const deduped = new Map<string, RawRow>()
  for (const row of next.rows) deduped.set(rowKey(row), row)
  next.rows = [...deduped.values()]
  next.warnings = [...new Set(next.warnings)].slice(0, 12)
  return next
}
