export function monthKeyFromParts(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`
}

export function shiftMonth(ym: string, delta: number): string {
  const [year, month] = ym.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1 + delta, 1))
  return monthKeyFromParts(date.getUTCFullYear(), date.getUTCMonth() + 1)
}

export function monthLabel(ym: string): string {
  const [year, month] = ym.split("-")
  return `${year.slice(2)}年${Number(month)}月`
}

export function compareMonth(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function daysInMonth(ym: string): number {
  const [year, month] = ym.split("-").map(Number)
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
}

export function headerToMonth(header: string): string | null {
  const text = header.replace(/\n/g, " ").trim()
  const iso = text.match(/\b(20\d{2})-(\d{2})\b/)
  if (iso) return `${iso[1]}-${iso[2]}`
  const named = text.match(
    /\b(Jan|Feb|Mar|Apr|May|June|Jun|July|Jul|Aug|Sept|Sep|Oct|Nov|Dec)\s*'?\s*(\d{2})\b/i,
  )
  if (!named) return null
  const month = MONTHS[named[1].toLowerCase()]
  return monthKeyFromParts(2000 + Number(named[2]), month)
}

export function monthFromUnknown(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return monthKeyFromParts(value.getFullYear(), value.getMonth() + 1)
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = excelSerialToDate(value)
    return date ? monthKeyFromParts(date.getUTCFullYear(), date.getUTCMonth() + 1) : null
  }
  if (typeof value === "string") {
    const match = value.trim().match(/^(\d{4})[-/](\d{1,2})/)
    if (match) return monthKeyFromParts(Number(match[1]), Number(match[2]))
  }
  return null
}

export function excelSerialToDate(serial: number): Date | null {
  if (serial < 20000 || serial > 80000) return null
  return new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000)
}

export function parseDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === "number" && Number.isFinite(value)) return excelSerialToDate(value)
  if (typeof value === "string" && value.trim()) {
    const match = value.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
    if (!match) return null
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  }
  return null
}

export function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const text = value.trim()
    if (!text || text.includes("#")) return null
    const parsed = Number(text.replace(/,/g, "").replace(/%/g, ""))
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function fmtInt(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—"
  return Math.round(value).toLocaleString("zh-HK")
}

export function fmtHkd(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—"
  return `HK$${Math.round(value).toLocaleString("zh-HK")}`
}

export function fmtPct(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value) || !Number.isFinite(value)) return "—"
  return `${(value * 100).toFixed(1)}%`
}

export function fmtDelta(current: number | null, previous: number | null): string | null {
  if (current === null || previous === null || previous === 0) return null
  const delta = (current - previous) / Math.abs(previous)
  const sign = delta > 0 ? "+" : ""
  return `${sign}${(delta * 100).toFixed(1)}%`
}
