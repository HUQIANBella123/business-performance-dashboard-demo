import * as XLSX from "xlsx"
import { asNumber, headerToMonth } from "./months"

export type SupplementMonth = Record<string, number>

const LABELS: Record<string, string> = {
  验车量: "motor",
  咨询量: "inquiries",
  一站式应续保: "due_onestop",
  一站式应续保已续保: "renewed_onestop",
  一站式应续保未续保: "open_onestop",
  等效先认应续保: "due_equiv",
  等效先认应续保已续保: "renewed_equiv",
  等效先认应续保未续保: "open_equiv",
}

function normalizeLabel(value: string): string {
  return value
    .replace(/^[\s\-–—]+/, "")
    .replace(/\s+/g, "")
    .replace(/[（(].*$/, "")
    .replace(/認/g, "认")
    .replace(/應/g, "应")
    .replace(/續/g, "续")
    .replace(/險/g, "险")
}

function metricKey(section: "sem" | "fb" | null, label: string): string | null {
  const name = normalizeLabel(label)
  if (LABELS[name]) return LABELS[name]
  if (!section) return null
  const lower = name.toLowerCase()
  if (lower.startsWith("impression")) return `${section}_impression`
  if (lower.startsWith("click")) return `${section}_clicks`
  if (lower.startsWith("ctr")) return `${section}_ctr`
  if (lower.startsWith("cpc")) return `${section}_cpc`
  if (lower.startsWith("cpa")) return `${section}_cpa`
  if (lower.startsWith("cost")) return `${section}_cost`
  if (lower.includes("coversion") || lower.includes("conversion")) return `${section}_conversion`
  return null
}

export function parseSupplement(buffer: ArrayBuffer): { months: Record<string, SupplementMonth>; warnings: string[] } {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true }) as unknown[][]
  const header = matrix[0] ?? []
  const columns: { index: number; month: string }[] = []
  header.forEach((cell, index) => {
    const month = headerToMonth(String(cell ?? ""))
    if (month) columns.push({ index, month })
  })
  if (!columns.length) return { months: {}, warnings: ["补充表没有 2026-01 这种月份表头"] }

  const months: Record<string, SupplementMonth> = {}
  for (const column of columns) months[column.month] = {}
  let section: "sem" | "fb" | null = null
  for (const row of matrix.slice(1)) {
    const label = String(row[0] ?? "").trim()
    if (!label) continue
    const normalized = normalizeLabel(label)
    if (normalized.toLowerCase().startsWith("semreport")) {
      section = "sem"
      continue
    }
    if (normalized.toLowerCase().startsWith("fbreport")) {
      section = "fb"
      continue
    }
    const key = metricKey(section, label)
    if (!key) continue
    for (const column of columns) {
      const value = asNumber(row[column.index])
      if (value === null) continue
      months[column.month][key] = value
    }
  }
  return { months, warnings: [] }
}
