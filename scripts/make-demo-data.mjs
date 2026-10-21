import { createRequire } from "node:module"
import { readdirSync } from "node:fs"
import { join } from "node:path"

const require = createRequire(import.meta.url)
const XLSX = require("xlsx")

function isDateFormat(format) {
  if (!format || format === "General") return false
  return /y{2,4}|d{1,2}|m{3,}|h:/.test(String(format).toLowerCase())
}

function fakeNumber(sheet, row, column, original) {
  const sign = original < 0 ? -1 : 1
  const size = Math.abs(original)
  const seed = (sheet.length * 131 + row * 17 + column * 13) % 97
  if (size < 1) return sign * ((seed % 20) + 5) / 100
  if (size < 100) return sign * ((seed % 80) + 10)
  if (size < 10000) return sign * ((seed % 800) + 100)
  return sign * ((seed % 8000) + 1000) * 10
}

const dir = "public/samples"
for (const name of readdirSync(dir).filter((file) => file.endsWith(".xlsx"))) {
  const path = join(dir, name)
  const workbook = XLSX.readFile(path, { cellDates: true })
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    for (const address of Object.keys(sheet)) {
      if (address.startsWith("!")) continue
      const cell = sheet[address]
      if (cell.t !== "n" || typeof cell.v !== "number" || cell.v === 0 || isDateFormat(cell.z)) continue
      const { r, c } = XLSX.utils.decode_cell(address)
      cell.v = fakeNumber(sheetName, r, c, cell.v)
      delete cell.w
      delete cell.f
    }
  }
  XLSX.writeFile(workbook, path)
  console.log("已替换数字", name)
}
