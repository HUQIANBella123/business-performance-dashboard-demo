import * as XLSX from "xlsx"
import { asNumber, headerToMonth } from "./months"

export type SocialBlock = {
  id: string
  title: string
  series: Record<string, Record<string, number>>
}

const TRADITIONAL: Record<string, string> = {
  書: "书",
  號: "号",
  發: "发",
  數: "数",
  關: "关",
  註: "注",
  閱: "阅",
  讀: "读",
  觀: "观",
  歡: "欢",
  點: "点",
  讚: "赞",
  薦: "荐",
  擊: "击",
  眾: "众",
  陣: "阵",
  紅: "红",
  總: "总",
  計: "计",
  與: "与",
  為: "为",
  這: "这",
  個: "个",
  們: "们",
  還: "还",
  對: "对",
  時: "时",
  會: "会",
  來: "来",
  後: "后",
  開: "开",
  無: "无",
  現: "现",
  實: "实",
  線: "线",
  費: "费",
  額: "额",
  從: "从",
  經: "经",
  過: "过",
  應: "应",
  續: "续",
  認: "认",
  戶: "户",
  廣: "广",
  國: "国",
  萬: "万",
  條: "条",
  裡: "里",
  並: "并",
}

export function toSimplified(text: string): string {
  const converted = [...text].map((char) => TRADITIONAL[char] ?? char).join("")
  return converted === "Total" ? "合计" : converted
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
      current = { id: `block-${blocks.length}`, title: toSimplified(label), series: {} }
      blocks.push(current)
      continue
    }
    const metric = toSimplified(label.replace(/^[\s\-–—]+/, "").trim())
    current.series[metric] ??= {}
    for (const column of columns) {
      const value = asNumber(row[column.index])
      if (value === null) continue
      current.series[metric][column.month] = value
    }
  }
  return { blocks: blocks.filter((block) => block.title && (Object.keys(block.series).length || block.title !== "合计")), warnings: [] }
}
