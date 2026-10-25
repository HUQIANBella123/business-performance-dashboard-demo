import * as XLSX from "xlsx"
import { headerToMonth, monthFromUnknown, monthLabel } from "./months"

type PreviewFile = { name: string; filename: string; bytes: ArrayBuffer }

function columnMonth(cell: unknown): string | null {
  if (cell instanceof Date || typeof cell === "number") {
    const dated = monthFromUnknown(cell)
    if (dated) return dated
  }
  return headerToMonth(String(cell ?? ""))
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function sheetTable(sheet: XLSX.WorkSheet, title: string, month: string): string {
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false }) as unknown[][]
  const width = Math.max(...matrix.map((row) => row.length), 0)
  let monthIndex = -1
  for (const row of matrix) {
    const found = row.findIndex((cell) => columnMonth(cell) === month)
    if (found >= 0) {
      monthIndex = found
      break
    }
  }
  const highlights: string[] = []
  if (monthIndex >= 0) {
    for (const row of matrix) {
      const label = String(row[2] || row[0] || "").replace(/\s+/g, " ").trim()
      if (!/应续保|應續保|已续保|已續保|未续保|未續保|renewal rate/i.test(label)) continue
      const value = row[monthIndex]
      if (value === "" || value === null || value === undefined) continue
      highlights.push(`${escapeHtml(label)}：${escapeHtml(value)}`)
    }
  }
  const rows = matrix
    .map((row) => {
      const cells = Array.from({ length: width }, (_, index) => {
        const mark = index === monthIndex ? " class=\"month\"" : ""
        return `<td${mark}>${escapeHtml(row[index] ?? "")}</td>`
      }).join("")
      return `<tr>${cells}</tr>`
    })
    .join("")
  const callout = highlights.length
    ? `<p class="callout">${escapeHtml(monthLabel(month))}这一列：${highlights.join("；")}</p>`
    : ""
  return `<section><h2>${escapeHtml(title)}</h2>${callout}<div class="sheet"><table>${rows}</table></div></section>`
}

export function openSourcePreview(file: PreviewFile, month: string) {
  const page = window.open("", "_blank")
  if (!page) return
  let body = "<p>这个文件不能按表格预览。可以回到看板下载原文件。</p>"
  try {
    const workbook = XLSX.read(file.bytes, { type: "array", cellDates: true })
    if (workbook.SheetNames.length) {
      body = workbook.SheetNames.map((name) => sheetTable(workbook.Sheets[name], name, month)).join("")
    }
  } catch {
    body = "<p>这个文件不能按表格预览。可以回到看板下载原文件。</p>"
  }
  page.document.open()
  page.document.write(`<!doctype html>
<html lang="zh-Hans">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(file.name)} · ${escapeHtml(monthLabel(month))}</title>
  <style>
    body { margin: 0; background: #f3eee6; color: #1c2430; font: 14px/1.5 "Noto Sans SC", "PingFang SC", sans-serif; }
    header { position: sticky; top: 0; background: #f7f1e6; border-bottom: 1px solid #e4d8c8; padding: 16px 20px; }
    h1 { margin: 0; font-size: 20px; }
    p { margin: 6px 0 0; color: #6f675e; }
    main { padding: 16px 20px 40px; }
    h2 { font-size: 16px; }
    .callout { background: #fbf8f3; border: 1px solid #e4d8c8; border-radius: 12px; padding: 10px 12px; color: #1c2430; }
    .sheet { overflow: auto; border: 1px solid #e4d8c8; border-radius: 12px; background: #fbf8f3; }
    table { border-collapse: collapse; min-width: 100%; }
    td { border: 1px solid #e4d8c8; padding: 4px 8px; white-space: nowrap; vertical-align: top; }
    td.month { background: #f3e2c2; font-weight: 600; }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(file.name)}</h1>
    <p>${escapeHtml(file.filename)} · 高亮列是 ${escapeHtml(monthLabel(month))}</p>
  </header>
  <main>${body}</main>
</body>
</html>`)
  page.document.close()
}

export function downloadSource(file: PreviewFile) {
  const url = URL.createObjectURL(new Blob([file.bytes]))
  const link = document.createElement("a")
  link.href = url
  link.download = file.filename
  link.click()
  URL.revokeObjectURL(url)
}
