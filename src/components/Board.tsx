import { useEffect, useMemo, useState, type ReactNode } from "react"
import { EChart } from "./EChart"
import { fmtInt, fmtPct } from "../lib/months"
import {
  channelForce,
  funnelOption,
  GAUGE_SPECS,
  mediaRadar,
  mediaTrendOption,
  momentumOption,
  planTree,
  premiumRiver,
  productBars,
  productSankey,
  reconcileScatter,
  renewalGauge,
  renewalHeat,
  roseOption,
  singleGauge,
  socialRadar,
} from "./screenCharts"
import { resolveSummary } from "../lib/narrative"
import { downloadSource, openSourcePreview } from "../lib/sourcePreview"
import { EDITION, EDITION_LABEL } from "../lib/edition"
import { SLOTS } from "../lib/slots"
import type { RulesConfig } from "../lib/rules"
import type { Conflict, StagedFile } from "../lib/staging"
import type { DashboardView, FileChip, Kpi } from "../lib/view"

const TABS = ["总览", "渠道", "保司与产品", "方案", "续保", "投放", "内容", "口径"] as const
type Tab = (typeof TABS)[number]

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
      <header className="border-b border-line bg-[#f7f1e6] text-ink">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs tracking-[0.28em] text-brass">CTIA · 决策大屏</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-pine md:text-4xl">港车北上业绩</h1>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold tracking-normal ${EDITION === "test" ? "bg-clay/15 text-clay" : "bg-pine/10 text-pine"}`}>{EDITION_LABEL}</span>
            </div>
          </div>
          <MonthPicker month={view.month} months={view.months} onConfirm={props.onMonth} />
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 md:px-6">
        {props.error && (
          <p className="rounded-lg border border-clay/30 bg-card px-4 py-3 text-sm text-clay">{props.error}</p>
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
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {SLOTS.map((slot) => {
                  const loaded = props.files.filter((file) => file.slot === slot.id)
                  return (
                    <div key={slot.id} className="rounded-xl border border-line bg-paper/60 p-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-medium">{slot.label}</p>
                        <p className="text-xs text-muted">{slot.hint}</p>
                      </div>
                      <label className="mt-3 flex cursor-pointer items-center justify-center rounded-md border border-dashed border-brass/50 px-2 py-2 text-sm text-brass hover:bg-card">
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
              <div className="mt-4 rounded-xl border border-line bg-card p-3">
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

        {tab === "总览" && <Overview view={view} files={props.files} />}
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

function Overview({ view, files }: { view: DashboardView; files: FileChip[] }) {
  const funnel = useMemo(() => funnelOption(view), [view])
  const momentum = useMemo(() => momentumOption(view.trend), [view.trend])
  const river = useMemo(() => premiumRiver(view.trend), [view.trend])
  const scatter = useMemo(() => reconcileScatter(view), [view])
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
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartFrame title="成交漏斗">
          <EChart option={funnel} className="h-full w-full" />
        </ChartFrame>
        <ChartFrame title="转化仪表" bodyClass="h-auto">
          <div className="grid gap-2 sm:grid-cols-3">
            {GAUGE_SPECS.map((spec) => (
              <EChart key={spec.id} option={singleGauge(view, spec)} className="h-56 w-full" />
            ))}
          </div>
        </ChartFrame>
      </div>
      <ChartFrame title="成交动量" bodyClass="h-96">
        <EChart option={momentum} className="h-full w-full" />
      </ChartFrame>
      <ChartFrame title="保费河流" bodyClass="h-96">
        <EChart option={river} className="h-full w-full" />
      </ChartFrame>
      {view.reconciliation.length > 0 && (
        <ChartFrame title="名单与销售报表对照">
          <EChart option={scatter} className="h-full w-full" />
        </ChartFrame>
      )}
      <Sources month={view.month} files={files} />
    </>
  )
}

const SOURCE_ROLE: Record<string, string> = {
  sales: "成交、保费、渠道、方案，以及一站式应续保、已续保、未续保、续保率",
  supplement: "验车、咨询、投放，以及等效先认应续保",
  social: "小红书和微信",
  nb: "新增名单",
  rn: "续保名单",
  actions: "本月行动",
}

function Sources({ month, files }: { month: string; files: FileChip[] }) {
  const used = files.filter((file) => file.months?.includes(month) || file.months?.includes("*"))
  return (
    <section className="screen-card p-4">
      <h2 className="text-lg font-semibold">数据来源</h2>
      {used.length === 0 && <p className="mt-3 text-sm text-muted">这个月还没有载入数据来源。</p>}
      <ul className="mt-3 grid gap-3 lg:grid-cols-2">
        {used.map((file) => (
          <li key={`${file.slot}-${file.filename}-${file.name}`} className="rounded-xl border border-line bg-paper/70 px-3 py-3">
            <p className="font-medium">{file.name}</p>
            <p className="mt-1 text-xs text-muted">{SOURCE_ROLE[file.slot] ?? file.detail}</p>
            <p className="mt-1 text-xs text-muted">{file.detail}</p>
            <div className="mt-3 flex gap-2">
              <button
                className="rounded-md bg-pine px-3 py-1.5 text-sm text-white disabled:opacity-40"
                disabled={!file.bytes}
                onClick={() => file.bytes && openSourcePreview({ name: file.name, filename: file.filename, bytes: file.bytes }, month)}
              >
                预览
              </button>
              <button
                className="rounded-md border border-line bg-card px-3 py-1.5 text-sm disabled:opacity-40"
                disabled={!file.bytes}
                onClick={() => file.bytes && downloadSource({ name: file.name, filename: file.filename, bytes: file.bytes })}
              >
                下载
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Channels({ view }: { view: DashboardView }) {
  const force = useMemo(() => channelForce(view.channels), [view.channels])
  const rose = useMemo(() => roseOption(view.channels, "渠道"), [view.channels])
  const mix = useMemo(
    () =>
      roseOption(
        [
          { name: "线上", value: findOnline(view, "online"), share: 0 },
          { name: "线下", value: findOnline(view, "offline"), share: 0 },
        ].filter((item) => item.value > 0),
        "线上线下",
      ),
    [view],
  )
  return (
    <>
      <Summary month={view.month} tab="渠道" text={view.narratives.channels} />
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartFrame title="渠道力导图">
          {view.channels.length === 0 ? <EmptyChart text="这个月没有渠道拆分。" /> : <EChart option={force} className="h-full w-full" />}
        </ChartFrame>
        <ChartFrame title="渠道占比">
          {view.channels.length === 0 ? <EmptyChart text="这个月没有渠道拆分。" /> : <EChart option={rose} className="h-full w-full" />}
        </ChartFrame>
      </div>
      <ChartFrame title="线上与线下">
        <EChart option={mix} className="h-full w-full" />
      </ChartFrame>
    </>
  )
}

function findOnline(view: DashboardView, id: "online" | "offline"): number {
  return view.sections.flatMap((section) => section.items).find((item) => item.id === id)?.value ?? 0
}

function Products({ view }: { view: DashboardView }) {
  const sankey = useMemo(() => productSankey(view), [view])
  const bars = useMemo(() => productBars(view), [view])
  const empty = view.products.length === 0
  return (
    <>
      <Summary month={view.month} tab="保司与产品" text={view.narratives.products} />
      <ChartFrame title="投保与产品流向" bodyClass="h-[34rem]">
        {empty ? <EmptyChart text="这个月还没有产品拆分。" /> : <EChart option={sankey} className="h-full w-full" />}
      </ChartFrame>
      <ChartFrame title="投保与产品结构" bodyClass="h-96">
        {empty ? <EmptyChart text="这个月还没有产品拆分。" /> : <EChart option={bars} className="h-full w-full" />}
      </ChartFrame>
    </>
  )
}

function Plans({ view }: { view: DashboardView }) {
  const tree = useMemo(() => planTree(view), [view])
  const hasPlans = view.plans.sections.some((section) => section.rows.length > 0)
  return (
    <>
      <Summary month={view.month} tab="方案" text={view.narratives.plans} />
      <ChartFrame title="方案结构" bodyClass="h-[32rem]">
        {hasPlans ? <EChart option={tree} className="h-full w-full" /> : <EmptyChart text="这个月还没有方案成交量。" />}
      </ChartFrame>
    </>
  )
}

function Renewal({ view }: { view: DashboardView }) {
  const heat = useMemo(() => renewalHeat(view.renewal.rows), [view.renewal.rows])
  const current = view.renewal.rows.find((row) => row.mark === "本月" && row.product === "一站式")
  const equivalent = view.renewal.rows.find((row) => row.mark === "本月" && row.product === "等效先认")
  const gauge = useMemo(() => renewalGauge(current), [current])
  return (
    <>
      <Summary month={view.month} tab="续保" text={view.narratives.renewal} />
      <section className="screen-card p-4">
        <h2 className="text-lg font-semibold">本月续保</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <RenewalStat label="一站式应续保" value={fmtRenewal(current?.due)} source={current?.source} />
          <RenewalStat label="一站式已续保" value={fmtRenewal(current?.renewed)} source={current?.source} />
          <RenewalStat label="一站式未续保" value={fmtRenewal(current?.open)} source={current?.source} />
          <RenewalStat label="一站式续保率" value={fmtPct(current?.rate ?? null)} source={current?.source} />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <RenewalStat label="等效先认应续保" value={fmtRenewal(equivalent?.due)} source={equivalent?.source} />
          <RenewalStat label="等效先认已续保" value={fmtRenewal(equivalent?.renewed)} source={equivalent?.source} />
          <RenewalStat label="等效先认未续保" value={fmtRenewal(equivalent?.open)} source={equivalent?.source} />
          <RenewalStat label="等效先认续保率" value={fmtPct(equivalent?.rate ?? null)} source={equivalent?.source} />
        </div>
      </section>
      <div className="grid gap-4 lg:grid-cols-5">
        <ChartFrame title="应续保热力" className="lg:col-span-3" bodyClass="h-96">
          <EChart option={heat} className="h-full w-full" />
        </ChartFrame>
        <ChartFrame title="本月一站式续保率" className="lg:col-span-2">
          <EChart option={gauge} className="h-full w-full" />
        </ChartFrame>
      </div>
    </>
  )
}

function fmtRenewal(value: number | null | undefined) {
  return fmtInt(value ?? null)
}

function RenewalStat({ label, value, source }: { label: string; value: string; source?: string }) {
  return (
    <article className="rounded-xl border border-line bg-paper/70 px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="num mt-1 text-3xl font-semibold text-ink">{value}</p>
      {source && <p className="mt-1 text-[11px] text-brass">{source}</p>}
    </article>
  )
}

function Media({ view }: { view: DashboardView }) {
  const radar = useMemo(() => mediaRadar(view), [view])
  const trend = useMemo(() => mediaTrendOption(view), [view])
  return (
    <>
      <Summary month={view.month} tab="投放" text={view.narratives.media} />
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartFrame title="投放雷达">
          <EChart option={radar} className="h-full w-full" />
        </ChartFrame>
        <ChartFrame title="花费曲线与转化点">
          <EChart option={trend} className="h-full w-full" />
        </ChartFrame>
      </div>
    </>
  )
}

function bareXiaohongshu(title: string) {
  return title.replace(/\s/g, "").replace(/書/g, "书").replace(/紅/g, "红") === "小红书"
}

function Social({ view }: { view: DashboardView }) {
  const blocks = view.social.filter((block) => !bareXiaohongshu(block.title))
  return (
    <>
      <Summary month={view.month} tab="内容" text={view.narratives.social} />
      {blocks.length === 0 && <EmptyChart text="还没有内容月报。" />}
      <div className="grid gap-4 lg:grid-cols-2">
        {blocks.map((block) => (
          <SocialBlock key={block.title} block={block} />
        ))}
      </div>
    </>
  )
}

function SocialBlock({ block }: { block: DashboardView["social"][number] }) {
  const radar = useMemo(() => socialRadar(block), [block])
  const ready = block.metrics.some((metric) => !metric.rate && metric.value !== null)
  return (
    <ChartFrame title={block.title} bodyClass="h-96">
      {ready ? <EChart option={radar} className="h-full w-full" /> : <EmptyChart text="这个账号还没有可画的数量指标。" />}
    </ChartFrame>
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
        className={`mt-1 w-full rounded-md border bg-card px-2 py-1.5 text-sm text-ink ${invalid || empty ? "border-clay" : "border-line"}`}
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
      <span className="text-muted">统计月</span>
      <select
        aria-label="年份"
        className="num rounded-md border border-line bg-card px-3 py-2 text-base text-ink"
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
        className="num rounded-md border border-line bg-card px-3 py-2 text-base text-ink"
        value={selectedMon}
        onChange={(event) => setMon(event.target.value)}
      >
        {monthOptions.map((item) => (
          <option key={item} value={item} className="text-ink">{Number(item)}月</option>
        ))}
      </select>
      <button
        className="rounded-md bg-pine px-3 py-2 text-sm font-medium text-white"
        onClick={() => onConfirm(`${year}-${selectedMon}`)}
      >
        确认
      </button>
    </div>
  )
}

const NOTE_PREFIX = "ctia-board-note:"
const NOTE_VERSION = "ctia-board-note:v2:"

function dropLegacyBoardNotes() {
  const drop: string[] = []
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (key?.startsWith(NOTE_PREFIX) && !key.startsWith(NOTE_VERSION)) drop.push(key)
  }
  for (const key of drop) window.localStorage.removeItem(key)
}

if (typeof window !== "undefined") dropLegacyBoardNotes()

function Summary({ month, tab, text }: { month: string; tab: string; text: string }) {
  const storageKey = `${NOTE_VERSION}${tab}:${month}`
  const read = (generated: string) => resolveSummary(window.localStorage.getItem(storageKey), generated)
  const [state, setState] = useState({ key: storageKey, base: text, value: read(text) })
  if (state.key !== storageKey || state.base !== text) setState({ key: storageKey, base: text, value: read(text) })
  return (
    <textarea
      aria-label={`${tab}总结`}
      className="min-h-32 w-full resize-y rounded-2xl border border-line bg-card px-4 py-3 text-sm leading-7"
      value={state.value}
      onChange={(event) => {
        const value = event.target.value
        window.localStorage.setItem(storageKey, JSON.stringify({ text: value, base: text }))
        setState({ key: storageKey, base: text, value })
      }}
    />
  )
}

function KpiCard({ item, compact = false }: { item: Kpi; compact?: boolean }) {
  const up = item.mom?.startsWith("+") || item.mom?.includes("升")
  const down = item.mom?.startsWith("-") || item.mom?.includes("降")
  return (
    <article className="screen-card px-4 py-3">
      <div className="flex flex-col items-start gap-1 lg:flex-row lg:items-center lg:justify-between lg:gap-2">
        <p className="min-w-0 text-xs text-muted">{item.label}</p>
        {item.source && <p className="shrink-0 whitespace-nowrap rounded-full border border-line px-2 py-0.5 text-[11px] text-brass">{item.source}</p>}
      </div>
      <p className={`num mt-1 font-semibold text-ink ${compact ? "text-2xl" : "text-3xl"}`}>{item.display}</p>
      <p className={`mt-1 text-xs ${up ? "text-moss" : down ? "text-clay" : "text-muted"}`}>
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
  bodyClass = "h-80",
}: {
  title: string
  note?: string
  children: ReactNode
  className?: string
  bodyClass?: string
}) {
  return (
    <section className={`screen-card p-4 ${className}`}>
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {note && <p className="mt-1 text-sm text-muted">{note}</p>}
      <div className={`mt-3 ${bodyClass}`}>{children}</div>
    </section>
  )
}

function EmptyChart({ text }: { text: string }) {
  return <p className="flex h-full items-center justify-center text-sm text-muted">{text}</p>
}
