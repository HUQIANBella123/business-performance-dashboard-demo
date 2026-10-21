export type ChannelGroup = "online" | "offline"

export type CommissionRule = {
  id: string
  insurer: string
  product?: string
  channelGroup?: ChannelGroup
  rate: number
  label: string
}

export type ChannelRule = {
  channel: string
  group: ChannelGroup
  from?: string
  until?: string
}

export type RulesConfig = {
  successStatuses: string[]
  priorityStatus: string
  piccFx: number
  taipingFxFallback: number
  emailChannelGroup: ChannelGroup
  equivalentOfflineRate: number
  equivalentOnlineRate: number
  oneStopRate: number
  taipingRate: number
}

export const DEFAULT_RULES: RulesConfig = {
  successStatuses: ["支付成功", "已上传证明"],
  priorityStatus: "支付成功",
  piccFx: 1.10170807453416,
  taipingFxFallback: 1.11,
  emailChannelGroup: "online",
  equivalentOfflineRate: 0.1,
  equivalentOnlineRate: 0.18,
  oneStopRate: 0.12,
  taipingRate: 0.2,
}

const RULES_KEY = "ctia-board-rules-v1"

const NUMBER_KEYS = ["piccFx", "taipingFxFallback", "equivalentOfflineRate", "equivalentOnlineRate", "oneStopRate", "taipingRate"] as const

export function sanitizeRules(input: unknown): RulesConfig {
  const source = input && typeof input === "object" ? (input as Partial<RulesConfig>) : {}
  const next: RulesConfig = { ...DEFAULT_RULES, ...source }
  for (const key of NUMBER_KEYS) {
    const value = source[key]
    next[key] = typeof value === "number" && Number.isFinite(value) ? value : DEFAULT_RULES[key]
  }
  if (!Array.isArray(source.successStatuses) || source.successStatuses.some((item) => typeof item !== "string" || !item)) {
    next.successStatuses = DEFAULT_RULES.successStatuses
  }
  if (source.emailChannelGroup !== "online" && source.emailChannelGroup !== "offline") {
    next.emailChannelGroup = DEFAULT_RULES.emailChannelGroup
  }
  if (typeof source.priorityStatus !== "string" || !source.priorityStatus) {
    next.priorityStatus = DEFAULT_RULES.priorityStatus
  }
  return next
}

export function loadRules(): RulesConfig {
  try {
    const raw = localStorage.getItem(RULES_KEY)
    if (!raw) return DEFAULT_RULES
    const parsed = JSON.parse(raw) as Partial<RulesConfig> | null
    if (!parsed || typeof parsed !== "object") return DEFAULT_RULES
    const clean = sanitizeRules(parsed)
    const repaired = NUMBER_KEYS.some((key) => typeof parsed[key] !== "number" || !Number.isFinite(parsed[key]))
    if (repaired) saveRules(clean)
    return clean
  } catch {
    return DEFAULT_RULES
  }
}

export function saveRules(rules: RulesConfig) {
  localStorage.setItem(RULES_KEY, JSON.stringify(rules))
}

export function normalizeProduct(value: string): string {
  const text = value.trim().replace(/認/g, "认").replace(/險/g, "险")
  if (text.includes("等效")) return "等效先认"
  if (text.includes("一站式")) return "一站式"
  return text
}

export function normalizeInsurer(value: string): string {
  const text = value.trim()
  if (text.includes("太平") || /taiping/i.test(text)) return "太平"
  if (text.includes("人保") || /picc/i.test(text)) return "人保"
  return text
}

export function normalizeChannel(value: string): string {
  const text = value.trim().replace(/\s+/g, "")
  if (!text) return "未填渠道"
  if (/新田/.test(text)) return "新田"
  if (/天水围|天水圍/.test(text)) return "天水围"
  if (/验车|驗車/.test(text)) return "验车网站"
  if (/sem/i.test(text) || /谷歌/.test(text)) return "谷歌SEM"
  if (/face\s*book/i.test(text)) return "Facebook"
  if (/官网|官網|organic/i.test(text)) return "官网"
  if (/电邮|電郵|email/i.test(text)) return "电邮"
  if (/证件|證件/.test(text)) return "证件部"
  return text
}

export function channelGroupFor(channel: string, month: string, _rules: RulesConfig): ChannelGroup | "unmapped" {
  if (channel === "电邮") return "online"
  if (channel === "天水围" || channel === "证件部") return "offline"
  if (channel === "官网" || channel === "谷歌SEM" || channel === "验车网站" || channel === "Facebook") {
    return "online"
  }
  if (channel === "新田") {
    return month <= "2025-10" ? "offline" : "online"
  }
  return "unmapped"
}

export function commissionRate(
  insurer: string,
  product: string,
  group: ChannelGroup | "unmapped",
  rules: RulesConfig,
): { rate: number; assumed: boolean } {
  if (insurer === "太平") return { rate: rules.taipingRate, assumed: false }
  if (product === "等效先认") {
    if (group === "offline") return { rate: rules.equivalentOfflineRate, assumed: false }
    if (group === "online") return { rate: rules.equivalentOnlineRate, assumed: false }
    return { rate: rules.equivalentOnlineRate, assumed: true }
  }
  return { rate: rules.oneStopRate, assumed: false }
}

export function channelRules(_rules: RulesConfig): ChannelRule[] {
  return [
    { channel: "天水围", group: "offline" },
    { channel: "证件部", group: "offline" },
    { channel: "新田", group: "offline", until: "2025-10" },
    { channel: "新田", group: "online", from: "2025-11" },
    { channel: "官网", group: "online" },
    { channel: "谷歌SEM", group: "online" },
    { channel: "验车网站", group: "online" },
    { channel: "Facebook", group: "online" },
    { channel: "电邮", group: "online" },
  ]
}
