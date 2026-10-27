import * as XLSX from "xlsx"
import { asNumber, headerToMonth, monthFromUnknown } from "./months"
import { normalizeProduct } from "./rules"

export type ChannelSlice = {
  insurer: string
  product: string
  biz: "nb" | "rn"
  group: "online" | "offline"
  channel: string
  count: number | null
  premium: number | null
}

export type ProductGroup = {
  insurer: string
  product: string
  biz: "nb" | "rn"
  group: "online" | "offline"
  count: number | null
  premium: number | null
}

export type PlanScope = "整体" | "等效先认" | "一站式" | "太平" | "人保"

export type PlanCount = {
  scope: PlanScope
  label: string
  count: number
}

export type ReportMonth = {
  month: string
  workingDays: number | null
  motor: number | null
  inquiries: number | null
  nbApplication: number | null
  rnApplication: number | null
  nbSales: number | null
  rnSales: number | null
  totalSales: number | null
  premiumTotal: number | null
  premiumNb: number | null
  premiumRn: number | null
  nbApplicationByInsurer: Record<string, number>
  rnApplicationByInsurer: Record<string, number>
  nbCountByInsurer: Record<string, number>
  rnCountByInsurer: Record<string, number>
  nbPremiumByInsurer: Record<string, number>
  rnPremiumByInsurer: Record<string, number>
  onlineNb: number | null
  offlineNb: number | null
  slices: ChannelSlice[]
  productGroups: ProductGroup[]
  plans: PlanCount[]
  oneStopDue: number | null
  oneStopRenewed: number | null
  oneStopOpen: number | null
  oneStopRate: number | null
  sem: Record<string, number>
  fb: Record<string, number>
  rnCountAnomaly: boolean
}

type Draft = Omit<ReportMonth, "rnCountAnomaly">

function clearUnclosed(draft: Draft) {
  const blank = (value: number | null) => value === null || value === 0
  if (!blank(draft.nbSales) || !blank(draft.nbApplication) || !blank(draft.premiumTotal)) return
  draft.nbApplication = null
  draft.rnApplication = null
  draft.nbSales = null
  draft.rnSales = null
  draft.totalSales = null
  draft.premiumTotal = null
  draft.premiumNb = null
  draft.premiumRn = null
  draft.onlineNb = null
  draft.offlineNb = null
  draft.nbApplicationByInsurer = {}
  draft.rnApplicationByInsurer = {}
  draft.nbCountByInsurer = {}
  draft.rnCountByInsurer = {}
  draft.nbPremiumByInsurer = {}
  draft.rnPremiumByInsurer = {}
  draft.slices = []
  draft.productGroups = []
  draft.plans = []
}

function blank(month: string): Draft {
  return {
    month,
    workingDays: null,
    motor: null,
    inquiries: null,
    nbApplication: null,
    rnApplication: null,
    nbSales: null,
    rnSales: null,
    totalSales: null,
    premiumTotal: null,
    premiumNb: null,
    premiumRn: null,
    nbApplicationByInsurer: {},
    rnApplicationByInsurer: {},
    nbCountByInsurer: {},
    rnCountByInsurer: {},
    nbPremiumByInsurer: {},
    rnPremiumByInsurer: {},
    onlineNb: null,
    offlineNb: null,
    slices: [],
    productGroups: [],
    plans: [],
    oneStopDue: null,
    oneStopRenewed: null,
    oneStopOpen: null,
    oneStopRate: null,
    sem: {},
    fb: {},
  }
}

function planLabel(name: string): string {
  return name.replace(/[（(][^）)]*[）)]/g, "").replace(/\s+/g, "").trim()
}

function planScopeOf(name: string): PlanScope | null {
  if (name.includes("Overall")) return "整体"
  if (name.includes("等效")) return "等效先认"
  if (name.includes("一站式")) return "一站式"
  if (/taiping/i.test(name)) return "太平"
  if (/picc/i.test(name)) return "人保"
  return null
}

function columnMonth(cell: unknown): string | null {
  if (cell instanceof Date || typeof cell === "number") {
    const dated = monthFromUnknown(cell)
    if (dated) return dated
  }
  return headerToMonth(String(cell ?? ""))
}

function rawLabel(row: unknown[]): string {
  return String(row[2] ?? "")
    .replace(/\n/g, " ")
    .trim()
}

function cleanLabel(label: string): string {
  return label.replace(/^[\s\-–—]+/, "").trim()
}

function channelOf(label: string): { channel: string; group: "online" | "offline" } | null {
  if (label.includes("官网")) return { channel: "官网", group: "online" }
  if (/谷歌\s*SEM/i.test(label)) return { channel: "谷歌SEM", group: "online" }
  if (label.includes("验车")) return { channel: "验车网站", group: "online" }
  if (/facebook/i.test(label)) return { channel: "Facebook", group: "online" }
  if (label.includes("电邮")) return { channel: "电邮", group: "online" }
  if (label.includes("天水围")) return { channel: "天水围", group: "offline" }
  if (label.includes("新田") && label.includes("11月")) return { channel: "新田", group: "online" }
  if (label.includes("新田")) return { channel: "新田", group: "offline" }
  return null
}

function touchSlice(
  draft: Draft,
  insurer: string,
  product: string,
  biz: "nb" | "rn",
  group: "online" | "offline",
  channel: string,
  kind: "count" | "premium",
  value: number,
) {
  let slice = draft.slices.find(
    (item) => item.insurer === insurer && item.product === product && item.biz === biz && item.channel === channel && item.group === group,
  )
  if (!slice) {
    slice = { insurer, product, biz, group, channel, count: null, premium: null }
    draft.slices.push(slice)
  }
  slice[kind] = value
}

function touchGroup(
  draft: Draft,
  insurer: string,
  product: string,
  biz: "nb" | "rn",
  group: "online" | "offline",
  kind: "count" | "premium",
  value: number,
) {
  let item = draft.productGroups.find(
    (row) => row.insurer === insurer && row.product === product && row.biz === biz && row.group === group,
  )
  if (!item) {
    item = { insurer, product, biz, group, count: null, premium: null }
    draft.productGroups.push(item)
  }
  item[kind] = value
}

function productHeader(name: string): { insurer: "太平" | "人保"; biz: "nb" | "rn" } | null {
  const compact = name.replace(/\s+/g, "")
  const match = compact.match(/^(Taiping|PICC)Product(?:-(NewSales|RN))?$/i)
  if (!match) return null
  return {
    insurer: /picc/i.test(match[1]) ? "人保" : "太平",
    biz: match[2]?.toLowerCase() === "rn" ? "rn" : "nb",
  }
}

export function parseSalesReport(buffer: ArrayBuffer): { months: Record<string, ReportMonth>; warnings: string[] } {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true })
  const sheet = workbook.Sheets["港车北上"]
  if (!sheet) return { months: {}, warnings: ["销售报表里没有「港车北上」工作表"] }
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true }) as unknown[][]
  const headerRow = matrix.find((row) => row.some((cell) => columnMonth(cell) === "2024-01"))
  if (!headerRow) return { months: {}, warnings: ["销售报表没有月份表头"] }

  const columns: { index: number; month: string }[] = []
  headerRow.forEach((cell, index) => {
    const month = columnMonth(cell)
    if (month) columns.push({ index, month })
  })
  const drafts = new Map<string, Draft>(columns.map((column) => [column.month, blank(column.month)]))

  let insurer: string | null = null
  let product: string | null = null
  let productBiz: "nb" | "rn" = "nb"
  let section: "premium" | "count" | "skip" | "media" = "premium"
  const rnProductCounts = new Set<string>()
  let media: "sem" | "fb" | null = null
  let applicationSide: "nb" | "rn" | null = null
  let planScope: PlanScope | null = null

  const write = (row: unknown[], apply: (draft: Draft, value: number) => void) => {
    for (const column of columns) {
      const value = asNumber(row[column.index])
      if (value === null) continue
      apply(drafts.get(column.month)!, value)
    }
  }

  for (const row of matrix) {
    const label = rawLabel(row)
    if (!label) continue
    const name = cleanLabel(label)
    const unit = String(row[3] ?? "").trim()
    const lower = name.toLowerCase()

    if (name === "一站式應續保" || name === "一站式应续保") {
      write(row, (draft, value) => { draft.oneStopDue = value })
      continue
    }
    if (name === "一站式已續保" || name === "一站式已续保") {
      write(row, (draft, value) => { draft.oneStopRenewed = value })
      continue
    }
    if (name === "一站式未續保" || name === "一站式未续保") {
      write(row, (draft, value) => { draft.oneStopOpen = value })
      continue
    }
    if (lower === "renewal rate") {
      write(row, (draft, value) => { draft.oneStopRate = value })
      continue
    }
    if (name.startsWith("Product Type-")) {
      planScope = planScopeOf(name)
      continue
    }
    if (planScope && name.includes("交强")) {
      const labelText = planLabel(name)
      const scope = planScope
      write(row, (draft, value) => {
        if (value <= 0) return
        const existing = draft.plans.find((item) => item.scope === scope && item.label === labelText)
        if (existing) existing.count = value
        else draft.plans.push({ scope, label: labelText, count: value })
      })
      continue
    }

    if (name.includes("Sales Breakup")) {
      section = "count"
      insurer = null
      product = null
      productBiz = "nb"
      applicationSide = null
      continue
    }
    if (name === "Product Breakup") {
      section = "premium"
      insurer = null
      product = null
      continue
    }
    if (name === "SEM Report") {
      section = "media"
      media = "sem"
      continue
    }
    if (name === "FB Report") {
      section = "media"
      media = "fb"
      continue
    }
    if (name === "数据来源" || name === "关键时间节点" || name.includes("Share Breakup") || name === "Avg. Price") {
      section = "skip"
      planScope = null
      continue
    }
    if (section === "skip") continue

    if (section === "media" && media) {
      const key = lower.replace(/^-+/, "")
      const metric = key.startsWith("impression")
        ? "impression"
        : key.startsWith("click")
          ? "clicks"
          : key.startsWith("ctr")
            ? "ctr"
            : key.startsWith("cpc")
              ? "cpc"
              : key.startsWith("cpa")
                ? "cpa"
                : key.startsWith("cost")
                  ? "cost"
                  : key.includes("coversion") || key.includes("conversion")
                    ? "conversion"
                    : null
      if (metric) write(row, (draft, value) => { draft[media!][metric] = value })
      continue
    }

    if (name === "No. of Working Days") {
      write(row, (draft, value) => { draft.workingDays = value })
      continue
    }
    if (name === "No. of Motor checked") {
      write(row, (draft, value) => { draft.motor = value })
      continue
    }
    if (name === "Total Premium") {
      section = "premium"
      write(row, (draft, value) => { draft.premiumTotal = value })
      continue
    }
    if (lower === "new sales" && unit === "$") {
      write(row, (draft, value) => { draft.premiumNb = value })
      continue
    }
    if (lower === "renewal" && unit === "$") {
      write(row, (draft, value) => { draft.premiumRn = value })
      continue
    }
    if (name === "Total Inquiries") {
      section = "count"
      write(row, (draft, value) => { draft.inquiries = value })
      continue
    }
    if (name === "NB Application") {
      applicationSide = "nb"
      write(row, (draft, value) => { draft.nbApplication = value })
      continue
    }
    if (name === "RN Application") {
      applicationSide = "rn"
      write(row, (draft, value) => { draft.rnApplication = value })
      continue
    }
    if (name === "NB Sales") {
      applicationSide = null
      write(row, (draft, value) => { draft.nbSales = value })
      continue
    }
    if (name === "RN Sales") {
      write(row, (draft, value) => { draft.rnSales = value })
      continue
    }
    if (name === "Total Sales") {
      write(row, (draft, value) => { draft.totalSales = value })
      continue
    }
    if (name === "-TAIPING" || name === "-PICC" || name === "TAIPING" || name === "PICC") {
      const who = name.includes("PICC") ? "人保" : "太平"
      if (applicationSide) {
        write(row, (draft, value) => {
          const bucket = applicationSide === "nb" ? draft.nbApplicationByInsurer : draft.rnApplicationByInsurer
          bucket[who] = value
        })
      }
      continue
    }
    const header = productHeader(name)
    if (header && (unit === "#" || unit === "$")) {
      insurer = header.insurer
      productBiz = header.biz
      product = null
      if (unit === "#") section = "count"
      if (unit === "$") section = "premium"
      const who = header.insurer
      const biz = header.biz
      write(row, (draft, value) => {
        if (biz === "rn") {
          if (section === "premium") draft.rnPremiumByInsurer[who] = value
          if (section === "count") {
            draft.rnCountByInsurer[who] = value
            rnProductCounts.add(`${draft.month}|${who}`)
          }
        } else {
          if (section === "premium") draft.nbPremiumByInsurer[who] = value
          if (section === "count") draft.nbCountByInsurer[who] = value
        }
      })
      continue
    }
    if (name.includes("一站式") || name.includes("等效先")) {
      product = normalizeProduct(name)
      continue
    }
    if (lower === "online channel" && !insurer && !product && section === "count") {
      write(row, (draft, value) => { draft.onlineNb = value })
      continue
    }
    if (lower === "offline channel" && !insurer && !product && section === "count") {
      write(row, (draft, value) => { draft.offlineNb = value })
      continue
    }
    if (lower === "online channel" && insurer && product) {
      write(row, (draft, value) => touchGroup(draft, insurer!, product!, productBiz, "online", section === "premium" ? "premium" : "count", value))
      continue
    }
    if ((lower === "ctg channel" || lower === "offline") && insurer && product) {
      write(row, (draft, value) => touchGroup(draft, insurer!, product!, productBiz, "offline", section === "premium" ? "premium" : "count", value))
      continue
    }
    if (name === "Taiping Renewal" || name === "PICC Renewal") {
      const who = name.startsWith("Taiping") ? "太平" : "人保"
      if (unit === "$") write(row, (draft, value) => { draft.rnPremiumByInsurer[who] = value })
      if (unit === "#") {
        write(row, (draft, value) => {
          if (rnProductCounts.has(`${draft.month}|${who}`)) return
          draft.rnCountByInsurer[who] = value
        })
      }
      continue
    }

    const channel = channelOf(name)
    if (channel && insurer && product && (section === "premium" || section === "count")) {
      write(row, (draft, value) => {
        touchSlice(draft, insurer!, product!, productBiz, channel.group, channel.channel, section === "premium" ? "premium" : "count", value)
      })
    }
  }

  const months: Record<string, ReportMonth> = {}
  const warnings: string[] = []
  for (const draft of drafts.values()) {
    const insurerRn = (draft.rnCountByInsurer["太平"] ?? 0) + (draft.rnCountByInsurer["人保"] ?? 0)
    const fromProduct = rnProductCounts.has(`${draft.month}|太平`) || rnProductCounts.has(`${draft.month}|人保`)
    if (fromProduct && insurerRn > 0) draft.rnSales = insurerRn
    else if ((draft.rnSales === null || draft.rnSales === 0) && insurerRn > 0) draft.rnSales = insurerRn
    clearUnclosed(draft)
    const rnCountAnomaly = (draft.rnSales === 0 || draft.rnSales === null) && (draft.premiumRn ?? 0) > 0
    if (rnCountAnomaly) {
      warnings.push(`${draft.month} 销售报表的续保成交单量为 0，续保保费仍有数。这一月的续保单量等待续保名单计算。`)
    }
    months[draft.month] = { ...draft, rnCountAnomaly }
  }
  return { months, warnings }
}
