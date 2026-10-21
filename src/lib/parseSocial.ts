import * as XLSX from "xlsx"
import { asNumber, headerToMonth } from "./months"

export type SocialBlock = {
  id: string
  title: string
  series: Record<string, Record<string, number>>
}

function isHeader(row: unknown[], columns: { index: number }[]): boolean {
  return columns.every((column) => asNumber(row[column.index]) === null)
}

export function parseSocial(buffer: ArrayBuffer): { blocks: SocialBlock[]; warnings: string[] } {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true }) as unknown[][]
  const header = matrix[0] ?? []
  const columns: { index: number; month: string }[] = []
  header.forEach((cell, index) => {
    const month = headerToMonth(String(cell ?? ""))
    if (month) columns.push({ index, month })
  })
  if (!columns.length) return { blocks: [], warnings: ["社媒月报没有月份表头"] }

  const blocks: SocialBlock[] = []
  let current: SocialBlock = { id: "total", title: "合计", series: {} }
  blocks.push(current)

  for (const row of matrix.slice(1)) {
    const label = String(row[0] ?? "").trim()
    if (!label) continue
    if (isHeader(row, columns)) {
      current = { id: `block-${blocks.length}`, title: label, series: {} }
      blocks.push(current)
      continue
    }
    const metric = label.replace(/^[\s\-–—]+/, "").trim()
    current.series[metric] ??= {}
    for (const column of columns) {
      const value = asNumber(row[column.index])
      if (value === null) continue
      current.series[metric][column.month] = value
    }
  }
  return { blocks: blocks.filter((block) => block.title && (Object.keys(block.series).length || block.title !== "合计")), warnings: [] }
}
