import * as XLSX from "xlsx"
import { asNumber, monthFromUnknown, parseDate } from "./months"
import { normalizeChannel, normalizeInsurer, normalizeProduct } from "./rules"

export type Biz = "nb" | "rn"

export type RawRow = {
  slot: string
  sourceFile: string
  plate: string
  insurer: string
  serial: string
  orderId: string
  product: string
  packageName: string
  coverageText: string
  jqLimit: number
  syLimit: number
  zwLimit: number
  effectiveMonth: string | null
  jqPremiumCny: number | null
  syPremiumCny: number | null
  totalCny: number | null
  totalHkd: number | null
  status: string
  month: string
  createdAt: string
  channel: string
  entry: string
  device: string
  biz: Biz
}

const HEADER_ALIASES: Record<string, keyof RawRow | "ignore"> = {
  车牌号码: "plate",
  保司: "insurer",
  中旅流水号: "serial",
  订单号: "orderId",
  产品: "product",
  套餐: "packageName",
  投保产品: "coverageText",
  交强险保额: "jqLimit",
  商业险保额: "syLimit",
  座位险保额: "zwLimit",
  起保日期: "effectiveMonth",
  交强险保费CNY: "jqPremiumCny",
  商业险保费CNY: "syPremiumCny",
  "总保费（含税）": "totalCny",
  "港币总保费（含税）": "totalHkd",
  投保状态: "status",
  创建时间: "month",
  渠道: "channel",
  入口: "entry",
  设备类型: "device",
}

export function parseListBuffer(
  buffer: ArrayBuffer,
  slot: string,
  biz: Biz,
  fileName: string,
): { rows: RawRow[]; warnings: string[] } {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true })
  const sheetName = workbook.SheetNames[0]
  const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    defval: null,
    raw: true,
  }) as unknown[][]
  if (!matrix.length) return { rows: [], warnings: [`${fileName} 是空表`] }

  const header = (matrix[0] ?? []).map((cell) => String(cell ?? "").trim())
  const index = new Map<keyof RawRow | "ignore", number>()
  header.forEach((name, position) => {
    const field = HEADER_ALIASES[name]
    if (field) index.set(field, position)
  })
  if (!index.has("plate") || !index.has("status") || !index.has("month")) {
    return { rows: [], warnings: [`${fileName} 不是申请/续保名单：缺少车牌、投保状态或创建时间`] }
  }

  const warnings: string[] = []
  const rows: RawRow[] = []
  const seen = new Set<string>()
  for (const line of matrix.slice(1)) {
    const cell = (field: keyof RawRow | "ignore") => {
      const position = index.get(field)
      return position === undefined ? null : line[position]
    }
    const plate = String(cell("plate") ?? "").trim()
    const status = String(cell("status") ?? "").trim()
    const month = monthFromUnknown(cell("month"))
    if (!plate || !month) continue
    const serial = String(cell("serial") ?? "").trim()
    const orderId = String(cell("orderId") ?? "").trim()
    const dedupeKey = `${slot}|${serial}|${orderId}|${status}|${month}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    const insurer = normalizeInsurer(String(cell("insurer") ?? ""))
    const created = parseDate(cell("month"))
    rows.push({
      slot,
      sourceFile: fileName,
      plate,
      insurer,
      serial,
      orderId,
      product: normalizeProduct(String(cell("product") ?? "")),
      packageName: String(cell("packageName") ?? "").trim(),
      coverageText: String(cell("coverageText") ?? "").trim(),
      jqLimit: asNumber(cell("jqLimit")) ?? 0,
      syLimit: asNumber(cell("syLimit")) ?? 0,
      zwLimit: asNumber(cell("zwLimit")) ?? 0,
      effectiveMonth: monthFromUnknown(cell("effectiveMonth")),
      jqPremiumCny: asNumber(cell("jqPremiumCny")),
      syPremiumCny: asNumber(cell("syPremiumCny")),
      totalCny: asNumber(cell("totalCny")),
      totalHkd: asNumber(cell("totalHkd")),
      status,
      month,
      createdAt: created ? created.toISOString() : `${month}-01`,
      channel: normalizeChannel(String(cell("channel") ?? "")),
      entry: String(cell("entry") ?? "").trim() || "未填入口",
      device: String(cell("device") ?? "").trim() || "未填设备",
      biz,
    })
  }
  if (!rows.length) warnings.push(`${fileName} 没有可读的名单行`)
  return { rows, warnings }
}
