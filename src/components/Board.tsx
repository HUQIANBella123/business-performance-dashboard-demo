import { useEffect, useState, type ReactNode } from "react"
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { SLOTS } from "../lib/slots"
import { fmtHkd, fmtInt, fmtPct, monthLabel } from "../lib/months"
import type { RulesConfig } from "../lib/rules"
import type { Conflict, StagedFile } from "../lib/staging"
import type { DashboardView, FileChip, Kpi } from "../lib/view"

const TABS = ["总览", "渠道", "保司与产品", "方案", "续保", "投放", "内容", "口径"] as const
type Tab = (typeof TABS)[number]

const PINE = "#1e3f34"
const MOSS = "#2f6d52"
const BRASS = "#a56b3c"
const CLAY = "#9a4032"

type Props = {
  ready: boolean
  error: string | null
  view: DashboardView
  rules: RulesConfig
  files: FileChip[]
  month: string
  staged: StagedFile[]
  conflicts: Conflict[]
  choices: Record<string, string>
  confirming: boolean
  onMonth: (month: string) => void
  onRules: (rules: RulesConfig) => void
  onResetRules: () => void
  onStage: (slot: string, file: File) => Promise<void>
  onUnstage: (id: string) => void
  onChoose: (conflictId: string, optionId: string) => void
  onSubmit: () => void
  onClear: (slot: string) => void
}

export function Board(props: Props) {
  const [tab, setTab] = useState<Tab>("总览")
  const [openUploads, setOpenUploads] = useState(false)
  const { view } = props

  return (
    <div className="min-h-screen">
      <header className="bg-pine text-[#f6f1e8]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs tracking-[0.22em] text-[#d7c4a4]">CTIA · 港车北上</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">业绩看板</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#e7efe9]">
              名单在浏览器里计算。统计月按创建时间。支付成功和已上传证明都算成交；同一车牌两者同时出现时只保留支付成功。
            </p>
          </div>
          <MonthPicker month={view.month} months={view.months} onConfirm={props.onMonth} />
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 md:px-6">
        {props.error && (
          <p className="rounded-lg border border-clay/30 bg-white px-4 py-3 text-sm text-clay">{props.error}</p>
        )}
        {!props.ready && <p className="text-sm text-muted">正在读取示例销售报表、补充表和内容月报…</p>}

        <section className="rounded-2xl border border-line bg-card">
          <button
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium"
            aria-expanded={openUploads}
            onClick={() => setOpenUploads((open) => !open)}
          >
            <span>上传数据</span>
            <span className="text-muted">{openUploads ? "收起" : "展开"} · {props.files.length} 个文件</span>
          </button>
          {openUploads && (
            <div className="border-t border-line px-4 py-4">
              <p className="text-sm text-muted">选择文件后先在下面预览覆盖的月份和内容。点提交后才进入看板。同一批文件里如果同一指标对不上，需要先看对照，再确认提交。</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {SLOTS.map((slot) => {
                  const loaded = props.files.filter((file) => file.slot === slot.id)
                  return (
                    <div key={slot.id} className="rounded-xl border border-line bg-paper/60 p-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-medium">{slot.label}</p>
                        <p className="text-xs text-muted">{slot.hint}</p>
                      </div>
                      <label className="mt-3 flex cursor-pointer items-center justify-center rounded-md border border-dashed border-brass/50 px-2 py-2 text-sm text-brass hover:bg-white">
                        选择文件
                        <input
                          className="sr-only"
                          type="file"
                          aria-label={`选择${slot.label}文件`}
                          accept={slot.accept}
                          multiple={slot.kind === "list"}
                          onChange={(event) => {
                            const list = event.target.files
                            if (!list) return
                            void Promise.all([...list].map((file) => props.onStage(slot.id, file)))
                            event.target.value = ""
                          }}
                        />
                      </label>
                      <ul className="mt-2 space-y-1 text-xs text-muted">
                        {loaded.length === 0 && <li>尚未提交</li>}
                        {loaded.map((file) => (
                          <li key={`${file.slot}-${file.name}`}>
                            {file.name}
                            <span className="mt-0.5 block text-[11px]">{file.detail}</span>
                          </li>
                        ))}
                      </ul>
                      {loaded.length > 0 && (
                        <button className="mt-2 text-xs text-clay" onClick={() => props.onClear(slot.id)}>
                          清空此栏
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 rounded-xl border border-line bg-white p-3">
                <h3 className="text-sm font-medium">待提交预览</h3>
                {props.staged.length === 0 && <p className="mt-2 text-sm text-muted">还没有待提交的文件。</p>}
                <ul className="mt-2 space-y-2">
                  {props.staged.map((file) => (
                    <li key={file.id} className="flex items-start justify-between gap-3 rounded-lg bg-paper px-3 py-2 text-sm">
                      <span>
                        <span className="font-medium">{SLOTS.find((slot) => slot.id === file.slot)?.label}</span>
                        <span className="mt-0.5 block">{file.name}</span>
                        <span className="mt-0.5 block text-xs text-muted">{file.summary}</span>
                        {file.warnings.map((warning) => (
                          <span key={warning} className="mt-0.5 block text-xs text-clay">{warning}</span>
                        ))}
                      </span>
                      <button className="shrink-0 text-xs text-clay" onClick={() => props.onUnstage(file.id)}>移除</button>
                    </li>
                  ))}
                </ul>
                {props.conflicts.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-medium">同一指标有不同数值，请选择保留哪一份</h3>
                    <p className="mt-1 text-xs text-muted">对照看完后，再点确认提交。名单和销售报表的合计差异不在这里比对，有名单的月份仍以名单为准。</p>
                    <div className="mt-2 max-h-80 space-y-3 overflow-auto">
                      {props.conflicts.map((conflict) => (
                        <fieldset key={conflict.id} className="rounded-lg border border-line px-3 py-2">
                          <legend className="px-1 text-sm">{conflict.label}</legend>
                          <div className="flex flex-col gap-1">
                            {conflict.options.map((option) => (
                              <label key={option.id} className="flex items-center gap-2 text-sm">
                                <input
                                  type="radio"
                                  name={conflict.id}
                                  checked={props.choices[conflict.id] === option.id}
                                  onChange={() => props.onChoose(conflict.id, option.id)}
                                />
                                <span>{option.source}</span>
                                <span className="num text-muted">{option.display}</span>
                              </label>
                            ))}
                          </div>
                        </fieldset>
                      ))}
                    </div>
                  </div>
                )}
                <button
                  className="mt-4 rounded-md bg-pine px-4 py-2 text-sm text-white disabled:opacity-40"
                  disabled={props.staged.length === 0}
                  onClick={props.onSubmit}
                >
                  {props.conflicts.length && props.confirming ? "确认提交" : "提交"}
                </button>
              </div>
            </div>
          )}
        </section>

        <nav className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map((item) => (
            <button
              key={item}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${tab === item ? "bg-pine text-white" : "bg-card text-ink border border-line"}`}
              onClick={() => setTab(item)}
            >
              {item}
            </button>
          ))}
        </nav>

        {tab === "总览" && <Overview view={view} />}
        {tab === "渠道" && <Channels view={view} />}
        {tab === "保司与产品" && <Products view={view} />}
        {tab === "方案" && <Plans view={view} />}
        {tab === "续保" && <Renewal view={view} />}
        {tab === "投放" && <Media view={view} />}
        {tab === "内容" && <Social view={view} />}
        {tab === "口径" && <Rules view={view} rules={props.rules} onRules={props.onRules} onReset={props.onResetRules} />}
      </main>
    </div>
  )
}

function Overview({ view }: { view: DashboardView }) {
  return (
    <>
      <Summary month={view.month} tab="总览" text={[view.narratives.overview, view.narratives.standout, view.actionLine].filter(Boolean).join("\n\n")} />
      {view.sections.map((section) => {
        const cohort = section.id === "rn" ? section.items.filter((item) => /^(m0|m1|m2)-/.test(item.id)) : []
        const items = cohort.length ? section.items.filter((item) => !/^(m0|m1|m2)-/.test(item.id)) : section.items
        return (
          <section key={section.id}>
            <h2 className="mb-3 text-lg font-semibold">{section.title}</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {items.map((item) => (
                <KpiCard key={item.id} item={item} compact={section.id !== "overall"} />
              ))}
            </div>
            {cohort.length > 0 && (
              <>
                <h3 className="mt-4 mb-3 text-base font-semibold">应续保情况</h3>
                <div className="grid grid-cols-3 gap-3">
                  {cohort.map((item) => (
                    <KpiCard key={item.id} item={item} compact />
                  ))}
                </div>
              </>
            )}
          </section>
        )
      })}
      <ChartFrame title="成交与验车">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={view.trend}>
            <CartesianGrid stroke="#eadfD2" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar yAxisId="left" dataKey="nbDeals" name="新增成交" stackId="deals" fill={PINE} isAnimationActive={false} />
            <Bar yAxisId="left" dataKey="rnDeals" name="续保成交" stackId="deals" fill={BRASS} isAnimationActive={false} />
            <Line yAxisId="right" dataKey="motor" name="验车数" stroke={CLAY} strokeWidth={2} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartFrame>
      <ChartFrame title="港币保费">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={view.trend}>
            <CartesianGrid stroke="#eadfD2" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value) => fmtHkd(Number(value))} />
            <Legend />
            <Bar dataKey="premiumNb" name="新增保费" stackId="p" fill={MOSS} isAnimationActive={false} />
            <Bar dataKey="premiumRn" name="续保保费" stackId="p" fill={BRASS} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartFrame>
      {view.reconciliation.length > 0 && (
        <section className="rounded-2xl border border-line bg-card p-4">
          <h2 className="text-lg font-semibold">名单与销售报表对照</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead className="text-left text-muted">
                <tr>
                  <th className="py-2 font-medium">指标</th>
                  <th className="py-2 font-medium">名单</th>
                  <th className="py-2 font-medium">销售报表</th>
                </tr>
              </thead>
              <tbody>
                {view.reconciliation.map((row) => (
                  <tr key={row.label} className="border-t border-line">
                    <td className="py-2">{row.label}</td>
                    <td className="num py-2">{row.label.includes("保费") ? fmtHkd(row.list) : fmtInt(row.list)}</td>
                    <td className="num py-2">{row.label.includes("保费") ? fmtHkd(row.report) : fmtInt(row.report)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  )
}

function Channels({ view }: { view: DashboardView }) {
  return (
    <>
      <Summary month={view.month} tab="渠道" text={view.narratives.channels} />
      <div className="grid gap-4 lg:grid-cols-5">
        <ChartFrame title="线上与线下" className="lg:col-span-3">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={view.trend}>
              <CartesianGrid stroke="#eadfD2" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="online" name="线上" stackId="c" fill={MOSS} isAnimationActive={false} />
              <Bar dataKey="offline" name="线下" stackId="c" fill={BRASS} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartFrame>
        <NameList title="渠道单量" rows={view.channels} className="lg:col-span-2" />
      </div>
    </>
  )
}

function Products({ view }: { view: DashboardView }) {
  return (
    <>
      <Summary month={view.month} tab="保司与产品" text={view.narratives.products} />
      <ChartFrame title="保司成交">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={view.trend}>
            <CartesianGrid stroke="#eadfD2" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="taiping" name="太平" stackId="i" fill={PINE} isAnimationActive={false} />
            <Bar dataKey="picc" name="人保" stackId="i" fill={BRASS} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartFrame>
      <section className="overflow-x-auto rounded-2xl border border-line bg-card p-4">
        <h2 className="text-lg font-semibold">产品 × 线上线下</h2>
        <table className="mt-3 w-full min-w-[36rem] text-sm">
          <thead className="text-left text-muted">
            <tr>
              <th className="py-2 font-medium">保司</th>
              <th className="py-2 font-medium">产品</th>
              <th className="py-2 font-medium">线上</th>
              <th className="py-2 font-medium">线下</th>
              <th className="py-2 font-medium">港币保费</th>
            </tr>
          </thead>
          <tbody>
            {view.products.length === 0 && (
              <tr>
                <td className="py-3 text-muted" colSpan={5}>
                  这个月还没有产品拆分。
                </td>
              </tr>
            )}
            {view.products.map((row) => (
              <tr key={`${row.insurer}-${row.product}`} className="border-t border-line">
                <td className="py-2">{row.insurer}</td>
                <td className="py-2">{row.product}</td>
                <td className="num py-2">{fmtInt(row.online)}</td>
                <td className="num py-2">{fmtInt(row.offline)}</td>
                <td className="num py-2">{row.premium ? fmtHkd(row.premium) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  )
}

function Plans({ view }: { view: DashboardView }) {
  const overall = view.plans.sections.find((section) => section.scope === "整体")?.rows ?? []
  return (
    <>
      <Summary month={view.month} tab="方案" text={view.narratives.plans} />
      {overall.length > 0 && (
        <ChartFrame title="整体方案成交">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={overall.slice(0, 8)} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid stroke="#eadfD2" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" width={220} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" name="成交" fill={PINE} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartFrame>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {view.plans.sections.map((section) => (
          <section key={section.scope} className="rounded-2xl border border-line bg-card p-4">
            <h2 className="text-lg font-semibold">{section.scope}</h2>
            <table className="mt-3 w-full text-sm">
              <thead className="text-left text-muted">
                <tr>
                  <th className="py-1 font-medium">保障组合</th>
                  <th className="py-1 font-medium">成交</th>
                </tr>
              </thead>
              <tbody>
                {section.rows.map((row) => (
                  <tr key={row.name} className="border-t border-line">
                    <td className="py-1.5 pr-3">{row.name}</td>
                    <td className="num py-1.5">{fmtInt(row.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </>
  )
}

function Renewal({ view }: { view: DashboardView }) {
  return (
    <>
      <Summary month={view.month} tab="续保" text={view.narratives.renewal} />
      <section className="overflow-x-auto rounded-2xl border border-line bg-card p-4">
        <table className="w-full min-w-[46rem] text-sm">
          <thead className="text-left text-muted">
            <tr>
              <th className="py-2 font-medium">月份</th>
              <th className="py-2 font-medium">产品</th>
              <th className="py-2 font-medium">应续保</th>
              <th className="py-2 font-medium">已续保</th>
              <th className="py-2 font-medium">未续保</th>
              <th className="py-2 font-medium">续保率</th>
              <th className="py-2 font-medium">来源</th>
            </tr>
          </thead>
          <tbody>
            {view.renewal.rows.map((row, index) => {
              const previous = view.renewal.rows[index - 1]
              const firstOfMonth = !previous || previous.month !== row.month
              const span = firstOfMonth ? view.renewal.rows.filter((item) => item.month === row.month).length : 0
              const tone = row.mark === "本月" ? "text-clay" : row.mark === "回顾" ? "text-muted" : "text-ink"
              const current = row.mark === "本月"
              return (
                <tr key={`${row.month}-${row.product}`} className={`border-t border-line ${tone} ${current ? "font-semibold" : ""}`}>
                  {firstOfMonth && (
                    <td className={`py-2 align-top ${current ? "border-l-4 border-clay pl-2" : ""}`} rowSpan={span}>
                      {monthLabel(row.month)}
                    </td>
                  )}
                  <td className="py-2">{row.product}</td>
                  <td className="num py-2">{fmtInt(row.due)}</td>
                  <td className="num py-2">{fmtInt(row.renewed)}</td>
                  <td className="num py-2">{fmtInt(row.open)}</td>
                  <td className="num py-2">{fmtPct(row.rate)}</td>
                  <td className="py-2">{row.source}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </>
  )
}

function Media({ view }: { view: DashboardView }) {
  return (
    <>
      <Summary month={view.month} tab="投放" text={view.narratives.media} />
      <div className="grid gap-4 md:grid-cols-2">
        {view.media.map((block) => (
          <section key={block.name} className="rounded-2xl border border-line bg-card p-4">
            <h2 className="text-lg font-semibold">{block.name}</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3">
              {block.metrics.map((metric) => (
                <div key={metric.label}>
                  <dt className="text-xs text-muted">{metric.label}</dt>
                  <dd className="num text-xl font-semibold">
                    {metric.value === null
                      ? "—"
                      : metric.label.includes("率")
                        ? fmtPct(metric.value)
                        : metric.label === "花费" || metric.label.includes("成本")
                          ? fmtHkd(metric.value)
                          : fmtInt(metric.value)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <ChartFrame title="投放花费与转化">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={view.mediaTrend}>
            <CartesianGrid stroke="#eadfD2" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar yAxisId="left" dataKey="semCost" name="SEM 花费" fill={PINE} isAnimationActive={false} />
            <Bar yAxisId="left" dataKey="fbCost" name="Facebook 花费" fill={BRASS} isAnimationActive={false} />
            <Line yAxisId="right" dataKey="semConversion" name="SEM 转化" stroke={MOSS} dot={false} isAnimationActive={false} />
            <Line yAxisId="right" dataKey="fbConversion" name="Facebook 转化" stroke={CLAY} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartFrame>
    </>
  )
}

function Social({ view }: { view: DashboardView }) {
  if (!view.social.length) {
    return (
      <>
        <Summary month={view.month} tab="内容" text={view.narratives.social} />
      </>
    )
  }
  return (
    <>
      <Summary month={view.month} tab="内容" text={view.narratives.social} />
      <div className="grid gap-4 lg:grid-cols-2">
        {view.social.map((block) => (
          <section key={block.title} className="overflow-x-auto rounded-2xl border border-line bg-card p-4">
            <h2 className="text-lg font-semibold">{block.title}</h2>
            <table className="mt-3 w-full min-w-[28rem] text-sm">
              <thead className="text-left text-muted">
                <tr>
                  <th className="py-1 font-medium">指标</th>
                  <th className="py-1 font-medium">本月</th>
                  <th className="py-1 font-medium">环比</th>
                  <th className="py-1 font-medium">同比</th>
                  <th className="py-1 font-medium">本年累计</th>
                </tr>
              </thead>
              <tbody>
                {block.metrics.map((metric) => (
                  <tr key={metric.label} className="border-t border-line">
                    <td className="py-1.5">{metric.label}</td>
                    <td className="num py-1.5">{metric.rate ? fmtPct(metric.value) : fmtInt(metric.value)}</td>
                    <td className="num py-1.5">{metric.mom ?? "—"}</td>
                    <td className="num py-1.5">{metric.yoy ?? "—"}</td>
                    <td className="num py-1.5">{metric.ytd === null ? "—" : fmtInt(metric.ytd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </>
  )
}

function Rules({
  view,
  rules,
  onRules,
  onReset,
}: {
  view: DashboardView
  rules: RulesConfig
  onRules: (rules: RulesConfig) => void
  onReset: () => void
}) {
  const [rateForm, setRateForm] = useState(0)
  const set = (patch: Partial<RulesConfig>) => onRules({ ...rules, ...patch })
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border border-line bg-card p-4 text-sm leading-6">
        <h2 className="text-lg font-semibold">计数</h2>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-muted">
          <li>一个自然月内，按创建时间归属。起保日期用于保障起期，以及按车牌推下一年的应续保。</li>
          <li>应续保只出一套数：去年同月起保的成交车牌，一辆车计 1。之后有更晚起保的成交即已续保，仍算在原产品。下一年改按新保单的起保月。</li>
          <li>同一车牌、同一业务、同一月份：有几笔支付成功就计几笔成交和申请。</li>
          <li>支付成功和已上传证明同时存在，只留支付成功那一笔。</li>
          <li>只有已上传证明时，不论几行，只计一笔。</li>
          <li>只有已申请时，计一笔申请、零笔成交。续保里没选中的套餐不会再加次数，保费只取成交行。</li>
          <li>商业险保费留空时按 0。港币总保费是金额主口径。日均成交按自然日计算，含工作日和非工作日，并分开新增和续保。</li>
          <li>电邮归在线上。新田在 2025 年 10 月及之前为线下，2025 年 11 月起为线上。</li>
        </ul>
        <h2 className="mt-5 text-lg font-semibold">佣金</h2>
        <p className="mt-2 text-muted">{view.fxNote}</p>
        <p className="mt-2 text-muted">
          太平佣金 = 港币保费 × 太平佣金率。人保一站式佣金 = 港币保费 × 人保一站式佣金率。人保等效先认线上、线下分别乘对应佣金率。渠道未能归入线上或线下时，人保等效先认先按线上佣金率估算，并在总览标出。
        </p>
        <RateFields key={rateForm} rules={rules} onChange={set} />
        <button
          className="mt-4 text-sm text-brass"
          onClick={() => {
            onReset()
            setRateForm((form) => form + 1)
          }}
        >
          恢复默认口径
        </button>
      </section>
      <section className="rounded-2xl border border-line bg-card p-4">
        <h2 className="text-lg font-semibold">这个月的检查</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {view.quality.map((item) => (
            <li key={item} className="rounded-lg bg-paper px-3 py-2">
              {item}
            </li>
          ))}
          {view.warnings.map((item) => (
            <li key={item} className="rounded-lg bg-paper px-3 py-2 text-clay">
              {item}
            </li>
          ))}
        </ul>
        <h2 className="mt-5 text-lg font-semibold">还不能从名单单独得到的数</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          验车数、咨询量、SEM 和 Facebook 来自「其他数据补充」，没有补充表时用 Sales Report。还没有名单时，一站式应续保、已续保、未续保用销售报表；名单上传后改按车牌计算，不读补充表。还没有续保名单时，销售报表分不出续保的线上成交和线下成交，总览里这两项显示为 —，不是 0。名单上传后改按名单计算。小红书和微信只来自内容月报。B2B 不在这张看板里。
        </p>
      </section>
    </div>
  )
}

function RateFields({ rules, onChange }: { rules: RulesConfig; onChange: (patch: Partial<RulesConfig>) => void }) {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <RateField label="太平佣金率" value={rules.taipingRate} onChange={(value) => onChange({ taipingRate: value })} />
      <RateField label="人保一站式佣金率" value={rules.oneStopRate} onChange={(value) => onChange({ oneStopRate: value })} />
      <RateField label="人保等效先认线上佣金率" value={rules.equivalentOnlineRate} onChange={(value) => onChange({ equivalentOnlineRate: value })} />
      <RateField label="人保等效先认线下佣金率" value={rules.equivalentOfflineRate} onChange={(value) => onChange({ equivalentOfflineRate: value })} />
    </div>
  )
}

function formatRate(value: number) {
  return String(Math.round(value * 1000) / 10)
}

function committedRate(text: string) {
  return /^\d+(\.\d+)?$/.test(text) && Number.isFinite(Number(text))
}

function RateField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(formatRate(value))
  const invalid = draft !== "" && !committedRate(draft) && !/^\d+\.$/.test(draft)
  const empty = draft.trim() === ""
  return (
    <label className="text-xs text-muted">
      {label}
      <input
        className={`mt-1 w-full rounded-md border bg-white px-2 py-1.5 text-sm text-ink ${invalid || empty ? "border-clay" : "border-line"}`}
        inputMode="decimal"
        aria-invalid={invalid || empty}
        value={draft}
        onChange={(event) => {
          const next = event.target.value
          setDraft(next)
          if (committedRate(next)) onChange(Number(next) / 100)
        }}
      />
      <span className={`mt-1 block ${invalid || empty ? "text-clay" : ""}`}>{invalid || empty ? "请填数字" : "填百分比，例如 25"}</span>
    </label>
  )
}

function MonthPicker({ month, months, onConfirm }: { month: string; months: string[]; onConfirm: (month: string) => void }) {
  const [year, setYear] = useState(month.slice(0, 4))
  const [mon, setMon] = useState(month.slice(5, 7))
  useEffect(() => {
    setYear(month.slice(0, 4))
    setMon(month.slice(5, 7))
  }, [month])
  const years = [...new Set(months.map((item) => item.slice(0, 4)))]
  const monthOptions = months.filter((item) => item.startsWith(`${year}-`)).map((item) => item.slice(5, 7))
  const selectedMon = monthOptions.includes(mon) ? mon : monthOptions[0] ?? mon
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-[#d7c4a4]">统计月</span>
      <select
        aria-label="年份"
        className="num rounded-md border border-white/20 bg-white/10 px-3 py-2 text-base text-white"
        value={year}
        onChange={(event) => {
          const nextYear = event.target.value
          setYear(nextYear)
          const available = months.filter((item) => item.startsWith(`${nextYear}-`)).map((item) => item.slice(5, 7))
          if (!available.includes(mon) && available[0]) setMon(available[0])
        }}
      >
        {years.map((item) => (
          <option key={item} value={item} className="text-ink">{item}年</option>
        ))}
      </select>
      <select
        aria-label="月份"
        className="num rounded-md border border-white/20 bg-white/10 px-3 py-2 text-base text-white"
        value={selectedMon}
        onChange={(event) => setMon(event.target.value)}
      >
        {monthOptions.map((item) => (
          <option key={item} value={item} className="text-ink">{Number(item)}月</option>
        ))}
      </select>
      <button
        className="rounded-md bg-[#d7c4a4] px-3 py-2 text-sm font-medium text-pine"
        onClick={() => onConfirm(`${year}-${selectedMon}`)}
      >
        确认
      </button>
    </div>
  )
}

function Summary({ month, tab, text }: { month: string; tab: string; text: string }) {
  const storageKey = `ctia-board-note:${tab}:${month}`
  const stored = window.localStorage.getItem(storageKey)
  const [state, setState] = useState({ key: storageKey, value: stored ?? text })
  if (state.key !== storageKey) setState({ key: storageKey, value: window.localStorage.getItem(storageKey) ?? text })
  return (
    <textarea
      aria-label={`${tab}总结`}
      className="min-h-32 w-full resize-y rounded-2xl border border-line bg-card px-4 py-3 text-sm leading-7"
      value={state.value}
      onChange={(event) => {
        const value = event.target.value
        window.localStorage.setItem(storageKey, value)
        setState({ key: storageKey, value })
      }}
    />
  )
}

function KpiCard({ item, compact = false }: { item: Kpi; compact?: boolean }) {
  return (
    <article className="rounded-2xl border border-line bg-card px-4 py-3">
      <div className="flex flex-col items-start gap-1 lg:flex-row lg:items-center lg:justify-between lg:gap-2">
        <p className="min-w-0 text-xs text-muted">{item.label}</p>
        {item.source && <p className="shrink-0 whitespace-nowrap rounded-full bg-paper px-2 py-0.5 text-[11px] text-brass">{item.source}</p>}
      </div>
      <p className={`num mt-1 font-semibold ${compact ? "text-2xl" : "text-3xl"}`}>{item.display}</p>
      <p className="mt-1 text-xs text-muted">
        {item.mom ? `环比 ${item.mom}` : "环比 —"}
        <span className="px-1">·</span>
        {item.yoy ? `同比 ${item.yoy}` : "同比 —"}
      </p>
      {item.note && <p className="mt-1 text-[11px] leading-4 text-muted">{item.note}</p>}
    </article>
  )
}

function ChartFrame({
  title,
  note,
  children,
  className = "",
}: {
  title: string
  note?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-2xl border border-line bg-card p-4 ${className}`}>
      <h2 className="text-lg font-semibold">{title}</h2>
      {note && <p className="mt-1 text-sm text-muted">{note}</p>}
      <div className="mt-3 h-72">{children}</div>
    </section>
  )
}

function NameList({ title, rows, className = "" }: { title: string; rows: { name: string; value: number; share: number }[]; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-card p-4 ${className}`}>
      <h2 className="text-lg font-semibold">{title}</h2>
      <ul className="mt-3 space-y-3">
        {rows.length === 0 && <li className="text-sm text-muted">这个月没有渠道拆分。</li>}
        {rows.map((row) => (
          <li key={row.name}>
            <div className="flex items-baseline justify-between text-sm">
              <span>{row.name}</span>
              <span className="num">{fmtInt(row.value)}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-paper">
              <div className="h-1.5 rounded-full bg-moss" style={{ width: `${Math.max(row.share * 100, 2)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
