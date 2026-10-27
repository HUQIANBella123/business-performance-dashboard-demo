import { useEffect, useMemo, useState } from "react"
import { Board } from "./components/Board"
import { actionLineFromOffice } from "./lib/actions"
import { parseListBuffer, type RawRow } from "./lib/parseList"
import { parseSalesReport, type ReportMonth } from "./lib/parseSalesReport"
import { parseSocial, type SocialBlock } from "./lib/parseSocial"
import { parseSupplement, type SupplementMonth } from "./lib/parseSupplement"
import { DEFAULT_RULES, loadRules, saveRules, type RulesConfig } from "./lib/rules"
import { SLOTS } from "./lib/slots"
import { applyStaged, detectConflicts, metricsFromReport, metricsFromSocial, metricsFromSupplement, type Conflict, type StagedFile } from "./lib/staging"
import { buildView, type FileChip } from "./lib/view"

const SAMPLES = [
  {
    slot: "sales",
    path: `${import.meta.env.BASE_URL}samples/ctia-sales-report.xlsx`,
    name: "CTIA SalesReport_B2C.xlsx",
    filename: "CTIA_SalesReport_B2C.xlsx",
  },
  {
    slot: "supplement",
    path: `${import.meta.env.BASE_URL}samples/ctia-bpr-supplement.xlsx`,
    name: "CTIA Business Performance Review其他数据补充.xlsx",
    filename: "CTIA_Business_Performance_Review其他数据补充.xlsx",
  },
  {
    slot: "social",
    path: `${import.meta.env.BASE_URL}samples/ctia-social-monthly.xlsx`,
    name: "CTIA B2C小红书及微信Monthly Report.xlsx",
    filename: "CTIA_B2C小红书及微信Monthly_Report.xlsx",
  },
]

async function stageFile(slot: string, file: File, label = file.name): Promise<StagedFile> {
  const definition = SLOTS.find((item) => item.id === slot)
  const id = `${slot}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const buffer = await file.arrayBuffer()
  const base: StagedFile = {
    id,
    slot,
    name: label,
    filename: file.name,
    bytes: buffer,
    summary: "没有读到内容",
    warnings: [],
    metrics: {},
    listKeys: [],
  }
  if (!definition) return { ...base, warnings: ["未知的上传位置"] }
  if (definition.kind === "list") {
    const parsed = parseListBuffer(buffer, slot, definition.biz, file.name)
    const fileTag = `${id}::${file.name}`
    const rows = parsed.rows.map((row) => ({ ...row, sourceFile: fileTag }))
    const months = [...new Set(rows.map((row) => row.month))].sort()
    const taiping = rows.filter((row) => row.insurer === "太平").length
    const picc = rows.filter((row) => row.insurer === "人保").length
    return {
      ...base,
      warnings: parsed.warnings,
      rows,
      summary: rows.length
        ? `${months[0]} 至 ${months[months.length - 1]} · ${rows.length} 行 · 太平 ${taiping} / 人保 ${picc}`
        : "没有读到名单",
      listKeys: rows
        .filter((row) => row.orderId)
        .map((row) => ({ orderId: row.orderId, status: row.status, hkd: row.totalHkd, fileTag })),
    }
  }
  if (definition.kind === "sales") {
    const parsed = parseSalesReport(buffer)
    const filled = Object.values(parsed.months).filter((item) => item.nbSales !== null).map((item) => item.month)
    const sample = filled.length ? parsed.months[filled[filled.length - 1]] : undefined
    return {
      ...base,
      warnings: parsed.warnings.slice(0, 4),
      report: parsed.months,
      metrics: metricsFromReport(parsed.months),
      summary: filled.length
        ? `${filled[0]} 至 ${filled[filled.length - 1]} · ${sample ? `${sample.month} 新增成交 ${sample.nbSales ?? "—"}、续保成交 ${sample.rnSales ?? "—"}` : ""}`
        : "没有月份",
    }
  }
  if (definition.kind === "supplement") {
    const parsed = parseSupplement(buffer)
    const keys = Object.keys(parsed.months).sort()
    return {
      ...base,
      warnings: parsed.warnings,
      supplement: parsed.months,
      metrics: metricsFromSupplement(parsed.months),
      summary: keys.length ? `${keys[0]} 至 ${keys[keys.length - 1]}` : "没有月份",
    }
  }
  if (definition.kind === "social") {
    const parsed = parseSocial(buffer)
    return {
      ...base,
      warnings: parsed.warnings,
      social: parsed.blocks,
      metrics: metricsFromSocial(parsed.blocks),
      summary: `${parsed.blocks.length} 个内容块`,
    }
  }
  const action = await actionLineFromOffice(buffer, file.name)
  return {
    ...base,
    warnings: action.warning ? [action.warning] : [],
    actionLine: action.line,
    summary: action.line || action.preview || "没有读到文字",
  }
}

export default function App() {
  const [rules, setRules] = useState<RulesConfig>(() => loadRules())
  const [rows, setRows] = useState<RawRow[]>([])
  const [report, setReport] = useState<Record<string, ReportMonth>>({})
  const [supplement, setSupplement] = useState<Record<string, SupplementMonth>>({})
  const [social, setSocial] = useState<SocialBlock[]>([])
  const [files, setFiles] = useState<FileChip[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [actionLine, setActionLine] = useState("")
  const [month, setMonth] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [staged, setStaged] = useState<StagedFile[]>([])
  const [choices, setChoices] = useState<Record<string, string>>({})
  const [confirming, setConfirming] = useState(false)

  const conflicts = useMemo(() => detectConflicts(staged), [staged])
  const resolvedChoices = useMemo(() => {
    const next = { ...choices }
    for (const conflict of conflicts) {
      if (!next[conflict.id]) next[conflict.id] = conflict.options[conflict.options.length - 1]?.id ?? ""
    }
    return next
  }, [choices, conflicts])

  useEffect(() => {
    let cancelled = false
    async function loadSamples() {
      try {
        let current = {
          rows: [] as RawRow[],
          report: {} as Record<string, ReportMonth>,
          supplement: {} as Record<string, SupplementMonth>,
          social: [] as SocialBlock[],
          actionLine: "",
          warnings: [] as string[],
          files: [] as FileChip[],
        }
        for (const sample of SAMPLES) {
          const response = await fetch(sample.path)
          if (!response.ok) throw new Error(sample.path)
          if (cancelled) return
          const filename = sample.filename ?? sample.path.split("/").pop() ?? sample.name
          const file = new File([await response.arrayBuffer()], filename)
          const stagedFile = await stageFile(sample.slot, file, sample.name)
          current = applyStaged(current, [stagedFile], [], {})
        }
        if (cancelled) return
        setRows(current.rows)
        setReport(current.report)
        setSupplement(current.supplement)
        setSocial(current.social)
        setActionLine(current.actionLine)
        setWarnings(current.warnings)
        setFiles(current.files)
        setReady(true)
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "示例文件没有载入")
          setReady(true)
        }
      }
    }
    void loadSamples()
    return () => {
      cancelled = true
    }
  }, [])

  const view = useMemo(
    () => buildView({ rows, report, supplement, social, files, warnings, actionLine }, rules, month),
    [rows, report, supplement, social, files, warnings, actionLine, rules, month],
  )

  useEffect(() => {
    if (ready && month === null && view.month) setMonth(view.month)
  }, [ready, month, view.month])

  function updateRules(next: RulesConfig) {
    setRules(next)
    saveRules(next)
  }

  function submitStaged() {
    if (!staged.length) return
    if (conflicts.length && !confirming) {
      setConfirming(true)
      return
    }
    const applied = applyStaged(
      { rows, report, supplement, social, actionLine, warnings, files },
      staged,
      conflicts,
      resolvedChoices,
    )
    setRows(applied.rows)
    setReport(applied.report)
    setSupplement(applied.supplement)
    setSocial(applied.social)
    setActionLine(applied.actionLine)
    setWarnings(applied.warnings)
    setFiles(applied.files)
    setStaged([])
    setChoices({})
    setConfirming(false)
  }

  return (
    <Board
      ready={ready}
      error={error}
      view={view}
      rules={rules}
      files={files}
      month={view.month}
      staged={staged}
      conflicts={conflicts as Conflict[]}
      choices={resolvedChoices}
      confirming={confirming}
      onMonth={setMonth}
      onRules={updateRules}
      onResetRules={() => updateRules(DEFAULT_RULES)}
      onStage={async (slot, file) => {
        const next = await stageFile(slot, file)
        setStaged((current) => [...current, next])
        setConfirming(false)
      }}
      onUnstage={(id) => {
        setStaged((current) => current.filter((item) => item.id !== id))
        setConfirming(false)
      }}
      onChoose={(conflictId, optionId) => setChoices((current) => ({ ...current, [conflictId]: optionId }))}
      onSubmit={submitStaged}
      onClear={(slot) => {
        setRows((current) => current.filter((row) => row.slot !== slot))
        if (slot === "sales") setReport({})
        if (slot === "supplement") setSupplement({})
        if (slot === "social") setSocial([])
        if (slot === "actions") setActionLine("")
        setFiles((current) => current.filter((file) => file.slot !== slot))
        setStaged((current) => current.filter((item) => item.slot !== slot))
      }}
    />
  )
}
