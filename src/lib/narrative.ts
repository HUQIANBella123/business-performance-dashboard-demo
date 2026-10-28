import { fmtHkd, fmtInt, fmtPct, monthLabel } from "./months"

export type NarrativeInput = {
  month: string
  motor: number | null
  inquiries: number | null
  deals: number | null
  nbDeals: number | null
  rnDeals: number | null
  nbApps: number | null
  rnApps: number | null
  hkd: number | null
  nbHkd: number | null
  rnHkd: number | null
  commission: number | null
  online: number | null
  offline: number | null
  taiping: number | null
  picc: number | null
  prev: Record<string, number | null>
  yoy: Record<string, number | null>
  topChannel: string | null
  topPlan: string | null
  planCount: number | null
  renewalDue: number | null
  renewalRenewed: number | null
  renewalOpen: number | null
  equivalentDue: number | null
  equivalentRenewed: number | null
  equivalentOpen: number | null
  nextRenewal: string | null
  semCost: number | null
  fbCost: number | null
  semClicks: number | null
  fbClicks: number | null
  socialHeadline: string | null
}

type Move = { label: string; kind: "环比" | "同比"; delta: number }

function rel(current: number | null, base: number | null): number | null {
  if (current === null || base === null || base === 0) return null
  return (current - base) / Math.abs(base)
}

function pctText(delta: number): string {
  return `${delta > 0 ? "上升" : "下降"} ${(Math.abs(delta) * 100).toFixed(1)}%`
}

function moves(input: NarrativeInput, fields: { key: string; label: string }[]): Move[] {
  const found: Move[] = []
  for (const field of fields) {
    const current = input[field.key as keyof NarrativeInput]
    if (typeof current !== "number" && current !== null) continue
    const mom = rel(current as number | null, input.prev[field.key] ?? null)
    const yoy = rel(current as number | null, input.yoy[field.key] ?? null)
    if (mom !== null && Math.abs(mom) >= 0.2) found.push({ label: field.label, kind: "环比", delta: mom })
    else if (yoy !== null && Math.abs(yoy) >= 0.2) found.push({ label: field.label, kind: "同比", delta: yoy })
  }
  return found.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
}

export function standoutLine(input: NarrativeInput): string {
  const found = moves(input, [
    { key: "motor", label: "验车数" },
    { key: "inquiries", label: "咨询量" },
    { key: "deals", label: "成交" },
    { key: "nbDeals", label: "新增成交" },
    { key: "rnDeals", label: "续保成交" },
    { key: "hkd", label: "港币保费" },
    { key: "nbHkd", label: "新增保费" },
    { key: "rnHkd", label: "续保保费" },
    { key: "online", label: "线上成交" },
    { key: "offline", label: "线下成交" },
  ]).slice(0, 3)
  if (!found.length) return "本月环比和同比都没有超过两成的起伏。"
  const listed = found.map((item) => `${item.label}${item.kind}${pctText(item.delta)}`).join("，")
  const lead = found[0]
  const downs = found.filter((item) => item.delta < 0).length
  const ups = found.length - downs
  const read =
    lead.label.includes("续保") && lead.delta < 0
      ? "续保是这个月最需要盯住的部分。"
      : lead.label.includes("验车") && lead.delta > 0 && (rel(input.deals, input.prev.deals) ?? 0) <= 0
        ? "验车在增加，成交没有同步上去。"
        : ups > 0 && downs > 0
          ? "涨跌都有，下月分开看原因。"
          : lead.delta < 0
            ? "这几项回落需要在下月的动作里单独看原因。"
            : "这几项走强，下月适合沿同一路径加量。"
  return `变化比较突出的是${listed}。${read}`
}

function suggestion(input: NarrativeInput): string {
  const dealMom = rel(input.deals, input.prev.deals)
  const motorMom = rel(input.motor, input.prev.motor)
  const rnMom = rel(input.rnDeals, input.prev.rnDeals)
  const conv = input.nbDeals !== null && input.nbApps ? input.nbDeals / input.nbApps : null
  if (rnMom !== null && rnMom <= -0.15) return "下月把未续保车牌提前触达，并跟上之后两个月的应续保窗口。"
  if (motorMom !== null && motorMom > 0.1 && dealMom !== null && dealMom <= 0) return "下月把验车后的申请和支付作为重点，避免流量停在验车。"
  if (conv !== null && conv < 0.75) return "下月复查新增申请到成交的流失，优先看报价和支付中断。"
  return "下月保持现在的线上获客和线下成交节奏，并提前准备后两个月的应续保。"
}

function pair(label: string, current: number | null, previous: number | null, lastYear: number | null, money = false): string {
  const fmt = money ? fmtHkd : fmtInt
  const mom = rel(current, previous)
  const yoy = rel(current, lastYear)
  return `${label} ${fmt(current)}（环比 ${mom === null ? "—" : pctText(mom)}，同比 ${yoy === null ? "—" : pctText(yoy)}）`
}

export function overviewNarrative(input: NarrativeInput): string {
  const when = monthLabel(input.month)
  const conv = input.nbDeals !== null && input.nbApps ? input.nbDeals / input.nbApps : null
  return [
    `${when}验车 ${fmtInt(input.motor)}，咨询 ${fmtInt(input.inquiries)}，成交 ${fmtInt(input.deals)}，其中新增 ${fmtInt(input.nbDeals)}、续保 ${fmtInt(input.rnDeals)}。`,
    `港币保费 ${fmtHkd(input.hkd)}，新增保费 ${fmtHkd(input.nbHkd)}，续保保费 ${fmtHkd(input.rnHkd)}，佣金 ${fmtHkd(input.commission)}。新增成交/新增申请 ${fmtPct(conv)}。`,
    `${pair("成交", input.deals, input.prev.deals, input.yoy.deals)}。${pair("港币保费", input.hkd, input.prev.hkd, input.yoy.hkd, true)}。`,
    `整体看，成交和保费${(rel(input.deals, input.prev.deals) ?? 0) >= 0 ? "较上月没有回落" : "较上月回落"}，线上 ${fmtInt(input.online)}、线下 ${fmtInt(input.offline)}。`,
    suggestion(input),
  ].join("")
}

export function channelNarrative(input: NarrativeInput): string {
  const onlineMom = rel(input.online, input.prev.online)
  const offlineMom = rel(input.offline, input.prev.offline)
  const top = input.topChannel ? `单量最高的渠道是${input.topChannel}。` : "这个月还没有渠道拆分。"
  const mix =
    input.online === null && input.offline === null
      ? "这个月还没有线上和线下成交。"
      : (input.offline ?? 0) > (input.online ?? 0)
        ? "线下成交多于线上。"
        : (input.online ?? 0) > (input.offline ?? 0)
          ? "线上成交多于线下。"
          : "线上和线下成交相同。"
  const next =
    onlineMom !== null && offlineMom !== null && onlineMom < offlineMom
      ? "下月可以检查线上申请到成交的衔接。"
      : onlineMom !== null && onlineMom > 0
        ? "下月可以继续放大已经走强的线上渠道。"
        : "下月分别看线上和线下从申请到成交的衔接。"
  return [
    `${monthLabel(input.month)}线上成交 ${fmtInt(input.online)}，线下成交 ${fmtInt(input.offline)}。${top}`,
    `线上环比 ${onlineMom === null ? "—" : pctText(onlineMom)}，同比 ${rel(input.online, input.yoy.online) === null ? "—" : pctText(rel(input.online, input.yoy.online) as number)}。`,
    `线下环比 ${offlineMom === null ? "—" : pctText(offlineMom)}，同比 ${rel(input.offline, input.yoy.offline) === null ? "—" : pctText(rel(input.offline, input.yoy.offline) as number)}。`,
    `${mix}${next}`,
  ].join("")
}

export function productNarrative(input: NarrativeInput): string {
  const total = (input.taiping ?? 0) + (input.picc ?? 0)
  const piccShare = total ? (input.picc ?? 0) / total : null
  return [
    `${monthLabel(input.month)}太平成交 ${fmtInt(input.taiping)}，人保成交 ${fmtInt(input.picc)}。`,
    `太平环比 ${rel(input.taiping, input.prev.taiping) === null ? "—" : pctText(rel(input.taiping, input.prev.taiping) as number)}，同比 ${rel(input.taiping, input.yoy.taiping) === null ? "—" : pctText(rel(input.taiping, input.yoy.taiping) as number)}。`,
    `人保环比 ${rel(input.picc, input.prev.picc) === null ? "—" : pctText(rel(input.picc, input.prev.picc) as number)}，同比 ${rel(input.picc, input.yoy.picc) === null ? "—" : pctText(rel(input.picc, input.yoy.picc) as number)}。`,
    `人保约占两家成交的 ${fmtPct(piccShare)}。下月按一站式和等效先认分开看保司结构，避免只看合计。`,
  ].join("")
}

export function planNarrative(input: NarrativeInput): string {
  if (!input.topPlan) {
    return `${monthLabel(input.month)}还没有方案成交量。上传销售报表或新增、续保列表后，这里按保障组合出数。`
  }
  return [
    `${monthLabel(input.month)}成交最多的保障组合是${input.topPlan}，${fmtInt(input.planCount)} 单。`,
    "销售报表目前给的是整体、一站式、等效先认、太平和人保的方案成交。新增和续保的方案拆分，要等每月名单上传后再出现。",
    "下月继续看头部方案是否集中，若某一档保额占比继续升高，报价和物料可以跟着这一档准备。",
  ].join("")
}

function cohortText(due: number | null, renewed: number | null, open: number | null): string {
  const rate = due ? (renewed ?? 0) / due : null
  return `应续保 ${fmtInt(due)}，已续保 ${fmtInt(renewed)}，未续保 ${fmtInt(open)}，续保率 ${fmtPct(rate)}`
}

export function renewalNarrative(input: NarrativeInput): string {
  const ahead = input.nextRenewal ? `本月之后两个月里，${input.nextRenewal}。` : ""
  return [
    `${monthLabel(input.month)}一站式${cohortText(input.renewalDue, input.renewalRenewed, input.renewalOpen)}。`,
    `等效先认${cohortText(input.equivalentDue, input.equivalentRenewed, input.equivalentOpen)}。`,
    ahead,
    "下月除了当月未续保，还要提前联系后面两个月到期的车牌。",
  ].join("")
}

export function resolveSummary(stored: string | null, generated: string): string {
  if (!stored) return generated
  try {
    const saved = JSON.parse(stored) as { text?: unknown }
    if (typeof saved.text === "string") return saved.text
  } catch {
    return generated
  }
  return generated
}

export function mediaNarrative(input: NarrativeInput): string {
  return [
    `${monthLabel(input.month)}谷歌 SEM 花费 ${fmtHkd(input.semCost)}、点击 ${fmtInt(input.semClicks)}，Facebook 花费 ${fmtHkd(input.fbCost)}、点击 ${fmtInt(input.fbClicks)}。`,
    `花费环比：SEM ${rel(input.semCost, input.prev.semCost) === null ? "—" : pctText(rel(input.semCost, input.prev.semCost) as number)}，Facebook ${rel(input.fbCost, input.prev.fbCost) === null ? "—" : pctText(rel(input.fbCost, input.prev.fbCost) as number)}。`,
    `同比：SEM ${rel(input.semCost, input.yoy.semCost) === null ? "—" : pctText(rel(input.semCost, input.yoy.semCost) as number)}，Facebook ${rel(input.fbCost, input.yoy.fbCost) === null ? "—" : pctText(rel(input.fbCost, input.yoy.fbCost) as number)}。`,
    "下月按每次点击成本和每次行为成本看投放是否变贵，花费增加但成交不增加时先收紧高成本计划。",
  ].join("")
}

export function socialNarrative(input: NarrativeInput): string {
  if (!input.socialHeadline) return "还没有内容月报。上传小红书及微信月报后，这里给出本月、环比、同比和本年累计。"
  return `${monthLabel(input.month)}${input.socialHeadline}内容页同时给出本月、环比、同比和本年累计。下月保持发布节奏，并把阅读或互动下滑的账号单独复盘。`
}
