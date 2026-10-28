import { buildCases, renewalFromCases, type CaseRecord } from "./cases"
import { compareMonth, daysInMonth, fmtDelta, fmtInt, monthLabel, shiftMonth } from "./months"
import {
  channelNarrative,
  mediaNarrative,
  overviewNarrative,
  planNarrative,
  productNarrative,
  renewalNarrative,
  socialNarrative,
  standoutLine,
  type NarrativeInput,
} from "./narrative"
import type { RawRow } from "./parseList"
import type { PlanCount, ReportMonth } from "./parseSalesReport"
import type { SocialBlock } from "./parseSocial"
import type { SupplementMonth } from "./parseSupplement"
import { commissionRate, type RulesConfig } from "./rules"

export type FileChip = {
  slot: string
  name: string
  filename: string
  detail: string
  months: string[]
  bytes?: ArrayBuffer
}

export type Bundle = {
  rows: RawRow[]
  report: Record<string, ReportMonth>
  supplement: Record<string, SupplementMonth>
  social: SocialBlock[]
  files: FileChip[]
  warnings: string[]
  actionLine?: string
}

export type Sourced = { value: number | null; source: string | null }

export type Kpi = {
  id: string
  label: string
  display: string
  value: number | null
  mom: string | null
  yoy: string | null
  source: string | null
  note?: string
}

export type TrendPoint = {
  month: string
  label: string
  nbDeals: number | null
  rnDeals: number | null
  premium: number | null
  premiumNb: number | null
  premiumRn: number | null
  motor: number | null
  online: number | null
  offline: number | null
  taiping: number | null
  picc: number | null
}

export type PlanSection = { scope: string; rows: NameValue[] }

export type RenewalRow = {
  month: string
  product: string
  due: number | null
  renewed: number | null
  open: number | null
  rate: number | null
  source: string
  mark: "回顾" | "本月" | "随后"
}

export type Narratives = {
  overview: string
  standout: string
  channels: string
  products: string
  plans: string
  renewal: string
  media: string
  social: string
}

export type NameValue = { name: string; value: number; share: number }

export type ProductSlice = {
  biz: "nb" | "rn"
  insurer: string
  product: string
  online: number
  offline: number
  premium: number
}

export type DashboardView = {
  month: string
  months: string[]
  sections: { id: string; title: string; items: Kpi[] }[]
  trend: TrendPoint[]
  channels: NameValue[]
  channelScope: string
  insurers: NameValue[]
  products: ProductSlice[]
  plans: { fromLists: boolean; sections: PlanSection[] }
  renewal: { rows: RenewalRow[]; hasLists: boolean; note: string }
  media: { name: string; metrics: { label: string; value: number | null; source: string | null }[] }[]
  mediaTrend: { month: string; label: string; semCost: number | null; fbCost: number | null; semConversion: number | null; fbConversion: number | null }[]
  social: { title: string; metrics: { label: string; value: number | null; mom: string | null; yoy: string | null; ytd: number | null; rate: boolean }[] }[]
  narratives: Narratives
  actionLine: string
  quality: string[]
  reconciliation: { label: string; list: number | null; report: number | null }[]
  fxNote: string
  warnings: string[]
}

function num(value: number | null | undefined, source: string | null): Sourced {
  return { value: value ?? null, source: value === null || value === undefined ? null : source }
}

function add(left: Sourced, right: Sourced): Sourced {
  if (left.value === null || right.value === null) return { value: null, source: null }
  const source = left.source === right.source ? left.source : "名单 + 销售报表"
  return { value: left.value + right.value, source }
}

function ratio(part: Sourced, whole: Sourced): Sourced {
  if (part.value === null || whole.value === null || whole.value === 0) return { value: null, source: null }
  return { value: part.value / whole.value, source: part.source }
}

function sumBy(cases: CaseRecord[], pick: (item: CaseRecord) => number): number {
  return cases.reduce((total, item) => total + pick(item), 0)
}

type MonthMetrics = {
  nbApps: Sourced
  rnApps: Sourced
  nbDeals: Sourced
  rnDeals: Sourced
  apps: Sourced
  deals: Sourced
  nbHkd: Sourced
  rnHkd: Sourced
  hkd: Sourced
  commission: Sourced
  nbCommission: Sourced
  rnCommission: Sourced
  motor: Sourced
  inquiries: Sourced
  online: Sourced
  offline: Sourced
  nbOnline: Sourced
  nbOffline: Sourced
  rnOnline: Sourced
  rnOffline: Sourced
  taiping: Sourced
  picc: Sourced
  nbTaiping: Sourced
  nbPicc: Sourced
  rnTaiping: Sourced
  rnPicc: Sourced
  workingDays: number | null
  channelScope: string
  cases: CaseRecord[]
}

function reportCommissionParts(report: ReportMonth | undefined, rules: RulesConfig): { nb: number | null; rn: number | null } {
  if (!report) return { nb: null, rn: null }
  let nb = 0
  let nbAny = false
  for (const group of report.productGroups) {
    if ((group.biz ?? "nb") !== "nb" || group.premium === null) continue
    nbAny = true
    nb += group.premium * commissionRate(group.insurer, group.product, group.group, rules).rate
  }
  let rn = 0
  let rnAny = false
  const taipingRn = report.rnPremiumByInsurer["太平"]
  const piccRn = report.rnPremiumByInsurer["人保"]
  if (taipingRn) {
    rnAny = true
    rn += taipingRn * rules.taipingRate
  }
  if (piccRn) {
    rnAny = true
    rn += piccRn * rules.oneStopRate
  }
  return { nb: nbAny ? nb : null, rn: rnAny ? rn : null }
}

function sumPresent(parts: Sourced[]): Sourced {
  const known = parts.filter((item) => item.value !== null)
  if (!known.length) return { value: null, source: null }
  return known.reduce((total, item) => ({
    value: (total.value ?? 0) + (item.value ?? 0),
    source: total.source === item.source ? total.source : "名单 + 销售报表",
  }))
}

function metricsAt(bundle: Bundle, cases: CaseRecord[], month: string, rules: RulesConfig): MonthMetrics {
  const monthCases = cases.filter((item) => item.month === month)
  const report = bundle.report[month]
  const supplement = bundle.supplement[month]

  const fromList = (biz: "nb" | "rn") => {
    const list = monthCases.filter((item) => item.biz === biz)
    if (!list.length) return null
    const deals = list.filter((item) => item.isDeal)
    return {
      apps: num(list.length, "名单"),
      deals: num(deals.length, "名单"),
      hkd: num(sumBy(deals, (item) => item.hkd), "名单"),
      commission: num(sumBy(deals, (item) => item.commission), "名单"),
      list,
      dealsList: deals,
    }
  }

  const nbList = fromList("nb")
  const rnList = fromList("rn")
  const nbApps = nbList?.apps ?? num(report?.nbApplication, "销售报表")
  const rnApps = rnList?.apps ?? num(report?.rnApplication, "销售报表")
  const nbDeals = nbList?.deals ?? num(report?.nbSales, "销售报表")
  const rnDeals = rnList?.deals ?? (report?.rnCountAnomaly ? num(null, null) : num(report?.rnSales, "销售报表"))
  const nbHkd = nbList?.hkd ?? num(report?.premiumNb, "销售报表")
  const rnHkd = rnList?.hkd ?? num(report?.premiumRn, "销售报表")

  const dealCases = monthCases.filter((item) => item.isDeal)
  const groupedDeals = (biz: "nb" | "rn", group: "online" | "offline"): number | null => {
    const rows = report?.productGroups.filter((item) => (item.biz ?? "nb") === biz && item.group === group && item.count !== null) ?? []
    if (!rows.length) return null
    return rows.reduce((total, item) => total + (item.count ?? 0), 0)
  }
  const channelBiz = (biz: "nb" | "rn", group: "online" | "offline"): Sourced => {
    if (monthCases.some((item) => item.biz === biz)) {
      return num(dealCases.filter((item) => item.biz === biz && item.channelGroup === group).length, "名单")
    }
    if (!report) return num(null, null)
    if (biz === "nb") {
      const direct = group === "online" ? report.onlineNb : report.offlineNb
      if (direct !== null) return num(direct, "销售报表")
    }
    return num(groupedDeals(biz, group), "销售报表")
  }
  const nbOnline = channelBiz("nb", "online")
  const nbOffline = channelBiz("nb", "offline")
  const rnOnline = channelBiz("rn", "online")
  const rnOffline = channelBiz("rn", "offline")
  const renewalChannels = (report?.slices ?? []).some((item) => (item.biz ?? "nb") === "rn" && (item.count ?? 0) > 0)
  const channelScope = dealCases.length ? "名单中的成交" : renewalChannels ? "销售报表的新增和续保成交" : "销售报表的新增成交"

  const insurerBiz = (insurer: string, biz: "nb" | "rn"): Sourced => {
    const listed = monthCases.filter((item) => item.biz === biz && item.insurer === insurer)
    if (listed.length) return num(listed.filter((item) => item.isDeal).length, "名单")
    if (biz === "rn" && report?.rnCountAnomaly) return num(null, null)
    const bucket = biz === "nb" ? report?.nbCountByInsurer : report?.rnCountByInsurer
    if (!bucket || bucket[insurer] === undefined) return num(null, null)
    return num(bucket[insurer], "销售报表")
  }
  const nbTaiping = insurerBiz("太平", "nb")
  const nbPicc = insurerBiz("人保", "nb")
  const rnTaiping = insurerBiz("太平", "rn")
  const rnPicc = insurerBiz("人保", "rn")

  const priced = reportCommissionParts(report, rules)
  const nbCommission = nbList?.commission ?? num(priced.nb, priced.nb === null ? null : "销售报表")
  const rnCommission = rnList?.commission ?? num(priced.rn, priced.rn === null ? null : "销售报表")
  const commission = sumPresent([nbCommission, rnCommission])

  const external = (key: string, fallback: number | null | undefined, fallbackSource: string): Sourced => {
    if (supplement && supplement[key] !== undefined) return num(supplement[key], "补充表")
    return num(fallback, fallbackSource)
  }

  return {
    nbApps,
    rnApps,
    nbDeals,
    rnDeals,
    apps: add(nbApps, rnApps),
    deals: add(nbDeals, rnDeals),
    nbHkd,
    rnHkd,
    hkd: add(nbHkd, rnHkd),
    commission,
    nbCommission,
    rnCommission,
    motor: external("motor", report?.motor, "销售报表"),
    inquiries: external("inquiries", report?.inquiries, "销售报表"),
    online: sumPresent([nbOnline, rnOnline]),
    offline: sumPresent([nbOffline, rnOffline]),
    nbOnline,
    nbOffline,
    rnOnline,
    rnOffline,
    taiping: sumPresent([nbTaiping, rnTaiping]),
    picc: sumPresent([nbPicc, rnPicc]),
    nbTaiping,
    nbPicc,
    rnTaiping,
    rnPicc,
    workingDays: report?.workingDays ?? null,
    channelScope,
    cases: monthCases,
  }
}

function kpi(id: string, label: string, current: Sourced, previous: Sourced, yoy: Sourced, display: (value: number | null) => string, note?: string): Kpi {
  return {
    id,
    label,
    display: display(current.value),
    value: current.value,
    mom: fmtDelta(current.value, previous.value),
    yoy: fmtDelta(current.value, yoy.value),
    source: current.source,
    note,
  }
}

function ranked(entries: [string, number][]): NameValue[] {
  const total = entries.reduce((sum, [, value]) => sum + value, 0)
  return entries
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value, share: total ? value / total : 0 }))
}

export function availableMonths(bundle: Bundle, cases: CaseRecord[]): string[] {
  const months = new Set<string>([
    ...cases.map((item) => item.month),
    ...Object.keys(bundle.report),
    ...Object.keys(bundle.supplement),
  ])
  return [...months].filter((month) => /^\d{4}-\d{2}$/.test(month)).sort(compareMonth)
}

export function buildView(bundle: Bundle, rules: RulesConfig, selected: string | null): DashboardView {
  const built = buildCases(bundle.rows, rules)
  const months = availableMonths(bundle, built.cases)
  const withDeals = [...months].reverse().find((month) => {
    const metrics = metricsAt(bundle, built.cases, month, rules)
    return (metrics.nbDeals.value ?? 0) > 0 || (metrics.deals.value ?? 0) > 0
  })
  const month = selected && months.includes(selected) ? selected : withDeals ?? months[months.length - 1] ?? shiftMonth(new Date().toISOString().slice(0, 7), -1)
  const current = metricsAt(bundle, built.cases, month, rules)
  const previous = metricsAt(bundle, built.cases, shiftMonth(month, -1), rules)
  const lastYear = metricsAt(bundle, built.cases, shiftMonth(month, -12), rules)
  const report = bundle.report[month]

  const int = (value: number | null) => (value === null || !Number.isFinite(value) ? "—" : Math.round(value).toLocaleString("zh-HK"))
  const hkd = (value: number | null) => (value === null || !Number.isFinite(value) ? "—" : `HK$${Math.round(value).toLocaleString("zh-HK")}`)
  const pct = (value: number | null) => (value === null || !Number.isFinite(value) ? "—" : `${(value * 100).toFixed(1)}%`)

  const calendarDays = daysInMonth(month)
  const prevDays = daysInMonth(shiftMonth(month, -1))
  const yoyDays = daysInMonth(shiftMonth(month, -12))
  const perDay = (deals: Sourced, days: number): Sourced =>
    deals.value === null ? num(null, null) : num(deals.value / days, deals.source)
  const dayText = (value: number | null) => (value === null ? "—" : value.toFixed(1))

  const overallItems: Kpi[] = [
    kpi("motor", "验车数", current.motor, previous.motor, lastYear.motor, int),
    kpi("inquiries", "咨询量", current.inquiries, previous.inquiries, lastYear.inquiries, int),
    kpi("apps", "申请", current.apps, previous.apps, lastYear.apps, int),
    kpi("deals", "成交", current.deals.value !== null ? current.deals : current.nbDeals, previous.deals.value !== null ? previous.deals : previous.nbDeals, lastYear.deals.value !== null ? lastYear.deals : lastYear.nbDeals, int),
    kpi("online", "线上成交", current.online, previous.online, lastYear.online, int),
    kpi("offline", "线下成交", current.offline, previous.offline, lastYear.offline, int),
    kpi("picc", "人保成交", current.picc, previous.picc, lastYear.picc, int),
    kpi("taiping", "太平成交", current.taiping, previous.taiping, lastYear.taiping, int),
    kpi("daily", "日均成交", perDay(current.deals.value !== null ? current.deals : current.nbDeals, calendarDays), perDay(previous.deals.value !== null ? previous.deals : previous.nbDeals, prevDays), perDay(lastYear.deals.value !== null ? lastYear.deals : lastYear.nbDeals, yoyDays), dayText),
    kpi("hkd", "港币保费", current.hkd, previous.hkd, lastYear.hkd, hkd),
    kpi("commission", "佣金", current.commission, previous.commission, lastYear.commission, hkd),
  ]

  const nbItems: Kpi[] = [
    kpi("nbMotor", "验车数", current.motor, previous.motor, lastYear.motor, int),
    kpi("nbApps", "新增申请", current.nbApps, previous.nbApps, lastYear.nbApps, int),
    kpi("nb", "新增成交", current.nbDeals, previous.nbDeals, lastYear.nbDeals, int),
    kpi("nbOnline", "新增线上成交", current.nbOnline, previous.nbOnline, lastYear.nbOnline, int),
    kpi("nbOffline", "新增线下成交", current.nbOffline, previous.nbOffline, lastYear.nbOffline, int),
    kpi("nbPicc", "新增人保成交", current.nbPicc, previous.nbPicc, lastYear.nbPicc, int),
    kpi("nbTaiping", "新增太平成交", current.nbTaiping, previous.nbTaiping, lastYear.nbTaiping, int),
    kpi("nbDaily", "日均成交", perDay(current.nbDeals, calendarDays), perDay(previous.nbDeals, prevDays), perDay(lastYear.nbDeals, yoyDays), dayText),
    kpi("sa", "申请转化率（新增成交/新增申请）", ratio(current.nbDeals, current.nbApps), ratio(previous.nbDeals, previous.nbApps), ratio(lastYear.nbDeals, lastYear.nbApps), pct),
    kpi("sm", "新增验车转化率（新增成交/验车）", ratio(current.nbDeals, current.motor), ratio(previous.nbDeals, previous.motor), ratio(lastYear.nbDeals, lastYear.motor), pct),
    kpi("nbHkd", "新增港币保费", current.nbHkd, previous.nbHkd, lastYear.nbHkd, hkd),
    kpi("nbCommission", "新增佣金", current.nbCommission, previous.nbCommission, lastYear.nbCommission, hkd),
  ]

  const rnItems: Kpi[] = [
    kpi("rnApps", "续保申请", current.rnApps, previous.rnApps, lastYear.rnApps, int),
    kpi("rn", "续保成交", current.rnDeals, previous.rnDeals, lastYear.rnDeals, int),
    kpi("rnOnline", "线上成交", current.rnOnline, previous.rnOnline, lastYear.rnOnline, int),
    kpi("rnOffline", "续保线下成交", current.rnOffline, previous.rnOffline, lastYear.rnOffline, int),
    kpi("rnPicc", "续保人保成交", current.rnPicc, previous.rnPicc, lastYear.rnPicc, int),
    kpi("rnTaiping", "续保太平成交", current.rnTaiping, previous.rnTaiping, lastYear.rnTaiping, int),
    kpi("rnDaily", "续保日均成交", perDay(current.rnDeals, calendarDays), perDay(previous.rnDeals, prevDays), perDay(lastYear.rnDeals, yoyDays), dayText),
    kpi("rnsa", "续保申请转化率（续保成交/续保申请）", ratio(current.rnDeals, current.rnApps), ratio(previous.rnDeals, previous.rnApps), ratio(lastYear.rnDeals, lastYear.rnApps), pct),
    kpi("rnHkd", "续保港币保费", current.rnHkd, previous.rnHkd, lastYear.rnHkd, hkd),
    kpi("rnCommission", "续保佣金", current.rnCommission, previous.rnCommission, lastYear.rnCommission, hkd),
  ]

  const trendMonths = months.filter((item) => item <= month).slice(-13)
  const trend: TrendPoint[] = trendMonths.map((item) => {
    const metrics = metricsAt(bundle, built.cases, item, rules)
    return {
      month: item,
      label: monthLabel(item),
      nbDeals: metrics.nbDeals.value,
      rnDeals: metrics.rnDeals.value,
      premium: metrics.hkd.value,
      premiumNb: metrics.nbHkd.value,
      premiumRn: metrics.rnHkd.value,
      motor: metrics.motor.value,
      online: metrics.online.value,
      offline: metrics.offline.value,
      taiping: metrics.taiping.value,
      picc: metrics.picc.value,
    }
  })

  const dealCases = current.cases.filter((item) => item.isDeal)
  const channelCounts = new Map<string, number>()
  if (!dealCases.length) {
    for (const slice of report?.slices ?? []) {
      if (!slice.count) continue
      channelCounts.set(slice.channel, (channelCounts.get(slice.channel) ?? 0) + slice.count)
    }
  }
  const channelBars = dealCases.length
    ? ranked(groupCount(dealCases, (item) => item.channel))
    : ranked([...channelCounts.entries()])

  const products = productMatrix(dealCases, report)

  const mediaMetric = (key: string, reportBag: Record<string, number> | undefined, field: string): Sourced => {
    const supplementValue = bundle.supplement[month]?.[key]
    if (supplementValue !== undefined) return num(supplementValue, "补充表")
    return num(reportBag?.[field], "销售报表")
  }
  const media = [
    {
      name: "谷歌 SEM",
      metrics: [
        ["曝光", "sem_impression", "impression"],
        ["点击", "sem_clicks", "clicks"],
        ["花费", "sem_cost", "cost"],
        ["转化", "sem_conversion", "conversion"],
        ["点击率", "sem_ctr", "ctr"],
        ["每次点击成本（CPC）", "sem_cpc", "cpc"],
        ["每次行为成本（CPA）", "sem_cpa", "cpa"],
      ].map(([label, key, field]) => ({ label, ...mediaMetric(key, report?.sem, field) })),
    },
    {
      name: "Facebook",
      metrics: [
        ["曝光", "fb_impression", "impression"],
        ["点击", "fb_clicks", "clicks"],
        ["花费", "fb_cost", "cost"],
        ["转化", "fb_conversion", "conversion"],
        ["点击率", "fb_ctr", "ctr"],
        ["每次点击成本（CPC）", "fb_cpc", "cpc"],
        ["每次行为成本（CPA）", "fb_cpa", "cpa"],
      ].map(([label, key, field]) => ({ label, ...mediaMetric(key, report?.fb, field) })),
    },
  ].map((block) => ({
    name: block.name,
    metrics: block.metrics.map((item) => ({ label: item.label, value: item.value, source: item.source })),
  }))

  const mediaTrend = trendMonths.map((item) => {
    const sup = bundle.supplement[item]
    const rep = bundle.report[item]
    return {
      month: item,
      label: monthLabel(item),
      semCost: sup?.sem_cost ?? rep?.sem.cost ?? null,
      fbCost: sup?.fb_cost ?? rep?.fb.cost ?? null,
      semConversion: sup?.sem_conversion ?? rep?.sem.conversion ?? null,
      fbConversion: sup?.fb_conversion ?? rep?.fb.conversion ?? null,
    }
  })

  const year = month.slice(0, 4)
  const social = bundle.social.map((block) => ({
    title: block.title,
    metrics: Object.entries(block.series).map(([label, series]) => {
      const value = series[month] ?? null
      const rate = label.includes("率")
      const ytd = rate
        ? null
        : Object.entries(series)
            .filter(([key]) => key.startsWith(year) && key <= month)
            .reduce((total, [, item]) => total + item, 0)
      return {
        label,
        value,
        mom: fmtDelta(value, series[shiftMonth(month, -1)] ?? null),
        yoy: fmtDelta(value, series[shiftMonth(month, -12)] ?? null),
        ytd,
        rate,
      }
    }),
  }))

  const plans = planSections(dealCases, report?.plans ?? [])
  const renewalRows = renewalWindow(bundle, built.cases, month)
  const nextMonth = shiftMonth(month, 1)
  const monthAfterNext = shiftMonth(month, 2)
  rnItems.push(
    ...cohortCards(renewalRows, month, "本月", "m0", int),
    ...cohortCards(renewalRows, nextMonth, monthLabel(nextMonth), "m1", int),
    ...cohortCards(renewalRows, monthAfterNext, monthLabel(monthAfterNext), "m2", int),
  )
  const narrative = narrativeInput({
    month,
    current,
    previous,
    lastYear,
    channels: channelBars,
    plans,
    renewalRows,
    media,
    mediaTrend,
    social,
  })
  const quality = [
    bundle.rows.length === 0
      ? "还没有名单。方案页先用销售报表里的整体、一站式、等效先认、太平和人保成交量；新增和续保的方案拆分等名单上传后再出现。"
      : built.mismatchCount
        ? `有 ${built.mismatchCount} 笔的投保产品文案和保额数字不一致，已按交强险、商业险、座位险保额归类。这通常是续保原计划：早期方案已停售，保额换成了最接近的现行方案。`
        : "当前名单里，投保产品文案和保额数字一致。",
    ...[...new Set(built.cases.filter((item) => item.channelGroup === "unmapped").map((item) => item.channel))].map(
      (channel) => `渠道「${channel}」还没有线上/线下分组。`,
    ),
    report?.rnCountAnomaly ? `${monthLabel(month)} 的销售报表续保单量不可用，续保保费仍读取报表。` : "",
    built.cases.some((item) => item.commissionAssumed && item.isDeal && item.month === month)
      ? "有人保等效先认成交还没有归入线上或线下，佣金暂按线上 20% 估算。"
      : "",
  ].filter(Boolean)

  const reconciliation = report
    ? [
        { label: "新增申请", list: nbListCount(current, "apps"), report: report.nbApplication },
        { label: "新增成交", list: nbListCount(current, "deals"), report: report.nbSales },
        { label: "新增保费", list: current.nbHkd.source === "名单" ? current.nbHkd.value : null, report: report.premiumNb },
        { label: "续保保费", list: current.rnHkd.source === "名单" ? current.rnHkd.value : null, report: report.premiumRn },
        { label: "验车数", list: null, report: report.motor },
      ].filter((item) => item.list !== null || item.report !== null)
    : []

  return {
    month,
    months,
    sections: [
      { id: "overall", title: "整体", items: overallItems },
      { id: "nb", title: "新增", items: nbItems },
      { id: "rn", title: "续保", items: rnItems },
    ],
    trend,
    channels: channelBars,
    channelScope: current.channelScope,
    insurers: ranked([
      ["太平", current.taiping.value ?? 0],
      ["人保", current.picc.value ?? 0],
    ]),
    products,
    plans,
    renewal: {
      rows: renewalRows,
      hasLists: bundle.rows.length > 0,
      note: "应续保按车牌算一套：去年同月起保的成交车牌计 1。之后有更晚起保的成交即已续保，仍算在原产品。下一年改按新保单的起保月。表内从去年同月看到本月，并带上之后两个月。有名单的月份改用名单。没有名单时，等效先认用表内该产品的应续保、已续保、未续保；表里没有这三行时记 0。",
    },
    media,
    mediaTrend,
    social,
    narratives: {
      overview: overviewNarrative(narrative),
      standout: standoutLine(narrative),
      channels: channelNarrative(narrative),
      products: productNarrative(narrative),
      plans: planNarrative(narrative),
      renewal: renewalNarrative(narrative),
      media: mediaNarrative(narrative),
      social: socialNarrative(narrative),
    },
    actionLine: bundle.actionLine ?? "",
    quality,
    reconciliation,
    fxNote: "佣金 = 港币保费 × 佣金率。有名单时按每笔成交的港币保费计算；只有销售报表时，新增用产品分组保费，续保用保司保费，再乘对应佣金率。",
    warnings: [...bundle.warnings, ...built.warnings].slice(0, 8),
  }
}

function cohortValue(rows: RenewalRow[], target: string, field: "due" | "renewed" | "open"): Sourced {
  const matched = rows.filter((row) => row.month === target)
  const values = matched.map((row) => row[field]).filter((value): value is number => value !== null)
  if (!values.length) return { value: null, source: null }
  const source = matched.find((row) => row[field] !== null)?.source ?? null
  return { value: values.reduce((sum, value) => sum + value, 0), source: source && source !== "暂无" && source !== "等名单" ? source : null }
}

function cohortCards(
  rows: RenewalRow[],
  target: string,
  prefix: string,
  idPrefix: string,
  display: (value: number | null) => string,
): Kpi[] {
  const one = (field: "due" | "renewed" | "open", label: string, id: string) =>
    kpi(
      id,
      `${prefix}${label}`,
      cohortValue(rows, target, field),
      cohortValue(rows, shiftMonth(target, -1), field),
      cohortValue(rows, shiftMonth(target, -12), field),
      display,
    )
  return [one("due", "应续保量", `${idPrefix}-due`), one("renewed", "应续保已续保量", `${idPrefix}-renewed`), one("open", "应续保未续保量", `${idPrefix}-open`)]
}

function nbListCount(metrics: MonthMetrics, field: "apps" | "deals"): number | null {
  const sourced = field === "apps" ? metrics.nbApps : metrics.nbDeals
  return sourced.source === "名单" ? sourced.value : null
}

function groupCount<T>(items: T[], keyFn: (item: T) => string): [string, number][] {
  const map = new Map<string, number>()
  for (const item of items) {
    const key = keyFn(item)
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return [...map.entries()]
}

function productMatrix(deals: CaseRecord[], report: ReportMonth | undefined): ProductSlice[] {
  if (deals.length) {
    const map = new Map<string, ProductSlice>()
    for (const item of deals) {
      const key = `${item.biz}|${item.insurer}|${item.product}`
      const row = map.get(key) ?? { biz: item.biz, insurer: item.insurer, product: item.product, online: 0, offline: 0, premium: 0 }
      if (item.channelGroup === "online") row.online += 1
      if (item.channelGroup === "offline") row.offline += 1
      row.premium += item.hkd
      map.set(key, row)
    }
    return [...map.values()]
  }
  const map = new Map<string, ProductSlice>()
  for (const item of report?.productGroups ?? []) {
    const key = `${item.biz}|${item.insurer}|${item.product}`
    const row = map.get(key) ?? { biz: item.biz, insurer: item.insurer, product: item.product, online: 0, offline: 0, premium: 0 }
    if (item.group === "online") {
      row.online += item.count ?? 0
      row.premium += item.premium ?? 0
    } else {
      row.offline += item.count ?? 0
      row.premium += item.premium ?? 0
    }
    map.set(key, row)
  }
  return [...map.values()]
}

function planSections(deals: CaseRecord[], reportPlans: PlanCount[]): { fromLists: boolean; sections: PlanSection[] } {
  if (deals.length) {
    const groups = [
      ["整体", deals],
      ["新增", deals.filter((item) => item.biz === "nb")],
      ["续保", deals.filter((item) => item.biz === "rn")],
      ["一站式", deals.filter((item) => item.product === "一站式")],
      ["等效先认", deals.filter((item) => item.product === "等效先认")],
      ["太平", deals.filter((item) => item.insurer === "太平")],
      ["人保", deals.filter((item) => item.insurer === "人保")],
    ] as const
    return {
      fromLists: true,
      sections: groups
        .map(([scope, rows]) => ({ scope, rows: ranked(groupCount(rows, (item) => item.coverageLabel)) }))
        .filter((section) => section.rows.length > 0),
    }
  }
  const scopes = ["整体", "等效先认", "一站式", "太平", "人保"]
  return {
    fromLists: false,
    sections: scopes
      .map((scope) => ({
        scope,
        rows: ranked(
          reportPlans.filter((item) => item.scope === scope && item.count > 0).map((item) => [item.label, item.count] as [string, number]),
        ),
      }))
      .filter((section) => section.rows.length > 0),
  }
}

function renewalWindow(bundle: Bundle, cases: CaseRecord[], month: string): RenewalRow[] {
  const rows: RenewalRow[] = []
  let cursor = shiftMonth(month, -12)
  const end = shiftMonth(month, 2)
  while (cursor <= end) {
    const mark: RenewalRow["mark"] = cursor < month ? "回顾" : cursor === month ? "本月" : "随后"
    const fromList = renewalFromCases(cases, cursor)
    if (fromList.some((item) => item.due > 0)) {
      for (const item of fromList) {
        rows.push({
          month: cursor,
          product: item.product,
          due: item.due,
          renewed: item.renewed,
          open: item.open,
          rate: item.rate,
          source: "名单",
          mark,
        })
      }
    } else {
      const report = bundle.report[cursor]
      const hasOneStop = Boolean(report && (report.oneStopDue !== null || report.oneStopRenewed !== null || report.oneStopOpen !== null))
      if (hasOneStop && report) {
        const due = report.oneStopDue
        const renewed = report.oneStopRenewed
        const open = report.oneStopOpen
        rows.push({
          month: cursor,
          product: "一站式",
          due,
          renewed,
          open,
          rate: report.oneStopRate ?? (due ? (renewed ?? 0) / due : null),
          source: "销售报表",
          mark,
        })
      } else {
        rows.push({ month: cursor, product: "一站式", due: null, renewed: null, open: null, rate: null, source: "暂无", mark })
      }
      if (cursor <= "2026-12") {
        rows.push({
          month: cursor,
          product: "等效先认",
          due: 0,
          renewed: 0,
          open: 0,
          rate: null,
          source: "表内未单列，记 0",
          mark,
        })
      } else {
        rows.push({ month: cursor, product: "等效先认", due: null, renewed: null, open: null, rate: null, source: "等名单", mark })
      }
    }
    cursor = shiftMonth(cursor, 1)
  }
  return rows
}

function narrativeInput(args: {
  month: string
  current: MonthMetrics
  previous: MonthMetrics
  lastYear: MonthMetrics
  channels: NameValue[]
  plans: { sections: PlanSection[] }
  renewalRows: RenewalRow[]
  media: DashboardView["media"]
  mediaTrend: DashboardView["mediaTrend"]
  social: DashboardView["social"]
}): NarrativeInput {
  const spend = (month: string, key: "semCost" | "fbCost") => args.mediaTrend.find((item) => item.month === month)?.[key] ?? null
  const card = (name: string, label: string) => args.media.find((item) => item.name.includes(name))?.metrics.find((item) => item.label === label)?.value ?? null
  const selected = args.renewalRows.find((row) => row.month === args.month && row.product === "一站式")
  const equivalent = args.renewalRows.find((row) => row.month === args.month && row.product === "等效先认")
  const upcoming = args.renewalRows.filter((row) => row.mark === "随后" && row.product === "一站式")
  const firstSocial = args.social
    .flatMap((block) => block.metrics.filter((metric) => !metric.rate && metric.value !== null).map((metric) => ({ block: block.title, metric })))
    .find(Boolean)
  const topPlan = args.plans.sections.find((section) => section.scope === "整体")?.rows[0]
  const bag = (metrics: MonthMetrics, month: string) => ({
    motor: metrics.motor.value,
    inquiries: metrics.inquiries.value,
    deals: metrics.deals.value ?? metrics.nbDeals.value,
    nbDeals: metrics.nbDeals.value,
    rnDeals: metrics.rnDeals.value,
    hkd: metrics.hkd.value,
    nbHkd: metrics.nbHkd.value,
    rnHkd: metrics.rnHkd.value,
    online: metrics.online.value,
    offline: metrics.offline.value,
    taiping: metrics.taiping.value,
    picc: metrics.picc.value,
    semCost: spend(month, "semCost"),
    fbCost: spend(month, "fbCost"),
  })
  return {
    month: args.month,
    ...bag(args.current, args.month),
    nbApps: args.current.nbApps.value,
    rnApps: args.current.rnApps.value,
    commission: args.current.commission.value,
    prev: bag(args.previous, shiftMonth(args.month, -1)),
    yoy: bag(args.lastYear, shiftMonth(args.month, -12)),
    topChannel: args.channels[0]?.name ?? null,
    topPlan: topPlan?.name ?? null,
    planCount: topPlan?.value ?? null,
    renewalDue: selected?.due ?? null,
    renewalRenewed: selected?.renewed ?? null,
    renewalOpen: selected?.open ?? null,
    equivalentDue: equivalent?.due ?? null,
    equivalentRenewed: equivalent?.renewed ?? null,
    equivalentOpen: equivalent?.open ?? null,
    nextRenewal: upcoming.length
      ? upcoming.map((row) => `${monthLabel(row.month)}应续保 ${fmtInt(row.due)}、已续保 ${fmtInt(row.renewed)}、未续保 ${fmtInt(row.open)}`).join("；")
      : null,
    semCost: card("SEM", "花费"),
    fbCost: card("Facebook", "花费"),
    semClicks: card("SEM", "点击"),
    fbClicks: card("Facebook", "点击"),
    socialHeadline: firstSocial
      ? `${firstSocial.block}${firstSocial.metric.label} ${fmtInt(firstSocial.metric.value)}，环比 ${firstSocial.metric.mom ?? "—"}，同比 ${firstSocial.metric.yoy ?? "—"}，本年累计 ${firstSocial.metric.ytd === null ? "—" : fmtInt(firstSocial.metric.ytd)}。`
      : null,
  }
}

