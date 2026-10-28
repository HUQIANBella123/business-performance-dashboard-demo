import type { EChartsOption } from "echarts"
import type { DashboardView, Kpi, NameValue, RenewalRow, TrendPoint } from "../lib/view"
import { fmtHkd, fmtInt, fmtPct, monthLabel } from "../lib/months"
import { AXIS, CORAL, GOLD, INK, PALETTE, TEAL, base } from "./EChart"

function num(value: number | null | undefined): number {
  return value ?? 0
}

export function findKpi(view: DashboardView, id: string): Kpi | undefined {
  return view.sections.flatMap((section) => section.items).find((item) => item.id === id)
}

export function funnelOption(view: DashboardView): EChartsOption {
  const steps = ["motor", "inquiries", "apps", "deals"]
    .map((id) => findKpi(view, id))
    .filter((item): item is Kpi => Boolean(item))
  return {
    ...base(),
    series: [
      {
        type: "funnel",
        left: "8%",
        right: "8%",
        top: 16,
        bottom: 12,
        minSize: "18%",
        maxSize: "100%",
        sort: "descending",
        gap: 6,
        label: { color: "#06221b", fontWeight: 600, formatter: "{b}\n{c}" },
        labelLine: { length: 12 },
        itemStyle: { borderColor: "#06221b", borderWidth: 2 },
        emphasis: { label: { fontSize: 16 } },
        data: steps.map((item, index) => ({
          name: item.label,
          value: Math.max(item.value ?? 0, 0),
          itemStyle: { color: PALETTE[index] },
        })),
      },
    ],
  }
}

export const GAUGE_SPECS = [
  { id: "sa", name: "新增转化" },
  { id: "sm", name: "验车转化" },
  { id: "rnsa", name: "续保转化" },
] as const

export function singleGauge(view: DashboardView, spec: (typeof GAUGE_SPECS)[number]): EChartsOption {
  const kpi = findKpi(view, spec.id)
  const raw = kpi?.value
  const value = raw === null || raw === undefined ? 0 : Math.max(0, Math.min(raw * 100, 150))
  const color = PALETTE[GAUGE_SPECS.findIndex((item) => item.id === spec.id)] ?? TEAL
  return {
    ...base(),
    series: [
      {
        type: "gauge",
        center: ["50%", "56%"],
        radius: "74%",
        min: 0,
        max: 100,
        progress: { show: true, width: 12, itemStyle: { color } },
        axisLine: { lineStyle: { width: 12, color: [[1, "rgba(138,163,153,0.25)"]] } },
        axisTick: { show: false },
        splitLine: { length: 8, distance: 4, lineStyle: { color: AXIS } },
        axisLabel: { color: AXIS, distance: 14, fontSize: 10 },
        pointer: { itemStyle: { color }, width: 4 },
        anchor: { show: true, size: 8, itemStyle: { color: GOLD } },
        title: { offsetCenter: [0, "78%"], color: INK, fontSize: 13 },
        detail: {
          valueAnimation: true,
          offsetCenter: [0, "46%"],
          color: INK,
          fontSize: 18,
          formatter: () => kpi?.display ?? "—",
        },
        data: [{ value, name: spec.name }],
      },
    ],
  }
}

export function momentumOption(trend: TrendPoint[]): EChartsOption {
  const labels = trend.map((item) => item.label)
  return {
    ...base(),
    legend: { textStyle: { color: AXIS }, top: 0 },
    grid: { left: 12, right: 16, top: 40, bottom: 52, containLabel: true },
    dataZoom: [{ type: "inside" }, { type: "slider", height: 18, bottom: 6, borderColor: "transparent", textStyle: { color: AXIS }, brushSelect: false }],
    xAxis: { type: "category", data: labels, axisLabel: { color: AXIS }, axisLine: { lineStyle: { color: "rgba(61,222,200,0.3)" } } },
    yAxis: [
      { type: "value", alignTicks: false, axisLabel: { color: AXIS }, splitLine: { lineStyle: { color: "rgba(138,163,153,0.15)" } } },
      { type: "value", alignTicks: false, axisLabel: { color: AXIS }, splitLine: { show: false } },
    ],
    series: [
      {
        name: "新增成交",
        type: "line",
        smooth: true,
        showSymbol: false,
        areaStyle: { color: "rgba(61,222,200,0.28)" },
        lineStyle: { width: 2, color: TEAL },
        data: trend.map((item) => item.nbDeals),
      },
      {
        name: "续保成交",
        type: "line",
        smooth: true,
        showSymbol: false,
        areaStyle: { color: "rgba(226,182,87,0.22)" },
        lineStyle: { width: 2, color: GOLD },
        data: trend.map((item) => item.rnDeals),
      },
      {
        name: "验车数",
        type: "line",
        yAxisIndex: 1,
        smooth: true,
        symbol: "circle",
        symbolSize: 7,
        lineStyle: { width: 2, type: "dashed", color: CORAL },
        itemStyle: { color: CORAL },
        data: trend.map((item) => item.motor),
      },
    ],
  }
}

export function premiumRiver(trend: TrendPoint[]): EChartsOption {
  return {
    ...base(),
    tooltip: { ...base().tooltip, trigger: "axis" },
    legend: { textStyle: { color: AXIS }, top: 0 },
    dataZoom: [
      { type: "inside", singleAxisIndex: 0 },
      {
        type: "slider",
        singleAxisIndex: 0,
        height: 22,
        bottom: 8,
        borderColor: "#e4d8c8",
        backgroundColor: "#f6f1e8",
        fillerColor: "rgba(47,109,82,0.25)",
        handleStyle: { color: "#2f6d52", borderColor: "#1e3f34" },
        moveHandleStyle: { color: "#2f6d52" },
        textStyle: { color: AXIS },
        brushSelect: false,
        showDetail: false,
      },
    ],
    singleAxis: {
      type: "time",
      orient: "horizontal",
      top: 36,
      bottom: 48,
      axisLabel: { color: AXIS, hideOverlap: true },
      axisLine: { lineStyle: { color: "rgba(61,222,200,0.35)" } },
    },
    series: [
      {
        type: "themeRiver",
        label: { show: false },
        emphasis: { label: { show: true, color: "#06221b" } },
        data: trend.flatMap((item) => [
          [`${item.month}-01`, num(item.premiumNb), "新增保费"],
          [`${item.month}-01`, num(item.premiumRn), "续保保费"],
        ]),
      },
    ],
  }
}

export function channelForce(rows: NameValue[]): EChartsOption {
  const top = rows.slice(0, 12)
  const hub = "本月渠道"
  return {
    ...base(),
    series: [
      {
        type: "graph",
        layout: "force",
        roam: true,
        draggable: true,
        force: { repulsion: 260, edgeLength: [40, 120] },
        lineStyle: { color: "rgba(61,222,200,0.45)", curveness: 0.15 },
        label: { show: true, color: INK, fontSize: 11 },
        emphasis: { focus: "adjacency", lineStyle: { width: 3 } },
        data: [
          { name: hub, value: top.reduce((sum, item) => sum + item.value, 0), symbolSize: 70, itemStyle: { color: GOLD } },
          ...top.map((item, index) => ({
            name: item.name,
            value: item.value,
            symbolSize: 22 + item.share * 80,
            itemStyle: { color: PALETTE[index % PALETTE.length] },
          })),
        ],
        links: top.map((item) => ({ source: hub, target: item.name, value: item.value })),
      },
    ],
  }
}

export function roseOption(rows: NameValue[], name: string): EChartsOption {
  return {
    ...base(),
    legend: { type: "scroll", bottom: 0, textStyle: { color: AXIS } },
    series: [
      {
        name,
        type: "pie",
        roseType: "area",
        radius: ["18%", "68%"],
        center: ["50%", "46%"],
        itemStyle: { borderRadius: 6, borderColor: "#06221b", borderWidth: 2 },
        label: { color: INK, formatter: "{b}\n{d}%" },
        data: rows.map((item, index) => ({
          name: item.name,
          value: item.value,
          itemStyle: { color: PALETTE[index % PALETTE.length] },
        })),
      },
    ],
  }
}

function bizLabel(biz: "nb" | "rn") {
  return biz === "nb" ? "新投保" : "续保"
}

function addLink(links: { source: string; target: string; value: number }[], source: string, target: string, value: number) {
  if (value <= 0) return
  const found = links.find((link) => link.source === source && link.target === target)
  if (found) found.value += value
  else links.push({ source, target, value })
}

export function productSankey(view: DashboardView): EChartsOption {
  const links: { source: string; target: string; value: number }[] = []
  const nodes: string[] = []
  const touch = (name: string) => {
    if (!nodes.includes(name)) nodes.push(name)
  }
  const businesses = [...new Set(view.products.map((row) => row.biz))].sort((a, b) => (a === b ? 0 : a === "nb" ? -1 : 1))
  for (const biz of businesses) touch(bizLabel(biz))
  for (const row of view.products) {
    const count = Math.max(row.online, 0) + Math.max(row.offline, 0)
    if (count <= 0) continue
    const biz = bizLabel(row.biz)
    const product = `${biz}·${row.product}`
    const insurer = `${product}·${row.insurer}`
    touch(product)
    touch(insurer)
    addLink(links, biz, product, count)
    addLink(links, product, insurer, count)
    if (row.online > 0) {
      touch("线上")
      addLink(links, insurer, "线上", row.online)
    }
    if (row.offline > 0) {
      touch("线下")
      addLink(links, insurer, "线下", row.offline)
    }
  }
  return {
    ...base(),
    series: [
      {
        type: "sankey",
        nodeAlign: "justify",
        nodeGap: 14,
        nodeWidth: 12,
        left: 8,
        right: 72,
        top: 12,
        bottom: 12,
        draggable: true,
        emphasis: { focus: "adjacency" },
        lineStyle: { color: "gradient", curveness: 0.5, opacity: 0.45 },
        label: {
          color: INK,
          fontSize: 12,
          formatter: (params) => {
            const name = String(params.name ?? "")
            const parts = name.split("·")
            return parts[parts.length - 1] ?? name
          },
        },
        itemStyle: { borderWidth: 0 },
        data: nodes.map((name) => ({ name })),
        links,
      },
    ],
  }
}

export function productBars(view: DashboardView): EChartsOption {
  const businesses = [
    { biz: "nb" as const, label: "新投保" },
    { biz: "rn" as const, label: "续保" },
  ]
  const products = [...new Set(["等效先认", "一站式", ...view.products.map((row) => row.product)])]
  const categories = businesses.flatMap((business) => products.map((product) => `${business.label}·${product}`))
  const series = [
    { name: "太平线上", insurer: "太平", channel: "online" as const },
    { name: "太平线下", insurer: "太平", channel: "offline" as const },
    { name: "人保线上", insurer: "人保", channel: "online" as const },
    { name: "人保线下", insurer: "人保", channel: "offline" as const },
  ]
  return {
    ...base(),
    legend: { top: 0, textStyle: { color: AXIS } },
    grid: { left: 12, right: 16, top: 40, bottom: 8, containLabel: true },
    xAxis: {
      type: "category",
      data: categories,
      axisLabel: { color: AXIS, interval: 0 },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: AXIS },
      splitLine: { lineStyle: { color: "rgba(138,163,153,0.15)" } },
    },
    series: series.map((item, index) => ({
      name: item.name,
      type: "bar" as const,
      barMaxWidth: 28,
      itemStyle: { color: PALETTE[index % PALETTE.length] },
      data: categories.map((category) => {
        const [label, product] = category.split("·")
        const biz = label === "新投保" ? "nb" : "rn"
        return view.products
          .filter((row) => row.biz === biz && row.product === product && row.insurer === item.insurer)
          .reduce((total, row) => total + (item.channel === "online" ? row.online : row.offline), 0)
      }),
    })),
  }
}

export function planTree(view: DashboardView): EChartsOption {
  return {
    ...base(),
    series: [
      {
        type: "treemap",
        roam: false,
        breadcrumb: { show: true, itemStyle: { color: "#1e3f34", textStyle: { color: "#fbf8f3" } }, emptyItemWidth: 12 },
        label: { color: "#06221b", formatter: "{b}\n{c}" },
        upperLabel: { show: true, height: 22, color: INK },
        itemStyle: { borderColor: "#06221b", borderWidth: 2, gapWidth: 2 },
        levels: [
          { itemStyle: { borderColor: GOLD, borderWidth: 3, gapWidth: 3 } },
          { colorSaturation: [0.35, 0.7], itemStyle: { borderColor: "#06221b", gapWidth: 1 } },
        ],
        data: view.plans.sections
          .filter((section) => section.rows.length)
          .map((section, index) => ({
            name: section.scope,
            itemStyle: { color: PALETTE[index % PALETTE.length] },
            children: section.rows.map((row) => ({ name: row.name, value: row.value })),
          })),
      },
    ],
  }
}

export function renewalHeat(rows: RenewalRow[]): EChartsOption {
  const months = [...new Set(rows.map((row) => row.month))]
  const products = [...new Set(rows.map((row) => row.product))]
  const bands = ["应续保", "已续保", "未续保"] as const
  const y = products.flatMap((product) => bands.map((band) => `${product} ${band}`))
  const data: [number, number, number][] = []
  months.forEach((month, x) => {
    products.forEach((product, productIndex) => {
      const row = rows.find((item) => item.month === month && item.product === product)
      const values = [row?.due ?? 0, row?.renewed ?? 0, row?.open ?? 0]
      values.forEach((value, bandIndex) => {
        data.push([x, productIndex * bands.length + bandIndex, value])
      })
    })
  })
  const max = Math.max(...data.map((item) => item[2]), 1)
  return {
    ...base(),
    grid: { left: 108, right: 24, top: 12, bottom: 28 },
    xAxis: { type: "category", data: months.map(monthLabel), axisLabel: { color: AXIS }, splitArea: { show: true } },
    yAxis: { type: "category", inverse: true, data: y, axisLabel: { color: AXIS, fontSize: 11 } },
    visualMap: {
      min: 0,
      max,
      calculable: true,
      orient: "horizontal",
      left: "center",
      bottom: 0,
      show: false,
      inRange: { color: ["#f6f1e8", "#ead7b4", "#d7b48a", "#8faf98"] },
    },
    series: [
      {
        type: "heatmap",
        data,
        label: { show: true, color: INK, fontSize: 10, formatter: (params) => fmtInt((params.value as number[])[2] ?? null) },
        emphasis: { itemStyle: { shadowBlur: 12, shadowColor: GOLD } },
      },
    ],
  }
}

export function renewalGauge(row: RenewalRow | undefined): EChartsOption {
  const rate = row?.rate === null || row?.rate === undefined ? 0 : Math.max(0, Math.min(row.rate * 100, 100))
  return {
    ...base(),
    series: [
      {
        type: "gauge",
        startAngle: 210,
        endAngle: -30,
        min: 0,
        max: 100,
        progress: { show: true, width: 14, itemStyle: { color: TEAL } },
        axisLine: { lineStyle: { width: 14, color: [[1, "rgba(138,163,153,0.2)"]] } },
        pointer: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        title: { offsetCenter: [0, "28%"], color: AXIS, fontSize: 13 },
        detail: { valueAnimation: true, offsetCenter: [0, "-8%"], color: GOLD, fontSize: 28, formatter: () => fmtPct(row?.rate ?? null) },
        data: [{ value: rate, name: "本月一站式续保率" }],
      },
    ],
  }
}

export function mediaRadar(view: DashboardView): EChartsOption {
  const labels = [...new Set(view.media.flatMap((block) => block.metrics.map((metric) => metric.label)))]
  const maxOf = (label: string) =>
    Math.max(...view.media.map((block) => Math.abs(block.metrics.find((metric) => metric.label === label)?.value ?? 0)), 1)
  return {
    ...base(),
    legend: { bottom: 0, textStyle: { color: AXIS } },
    radar: {
      indicator: labels.map((label) => ({ name: label, max: maxOf(label) })),
      axisName: { color: AXIS, fontSize: 11 },
      splitLine: { lineStyle: { color: "rgba(61,222,200,0.2)" } },
      splitArea: { areaStyle: { color: ["rgba(61,222,200,0.04)", "rgba(226,182,87,0.04)"] } },
    },
    series: [
      {
        type: "radar",
        emphasis: { lineStyle: { width: 3 } },
        data: view.media.map((block, index) => ({
          name: block.name,
          value: labels.map((label) => block.metrics.find((metric) => metric.label === label)?.value ?? 0),
          areaStyle: { color: `${PALETTE[index]}33` },
          lineStyle: { color: PALETTE[index] },
          itemStyle: { color: PALETTE[index] },
        })),
      },
    ],
  }
}

export function mediaTrendOption(view: DashboardView): EChartsOption {
  const points = view.mediaTrend
  return {
    ...base(),
    legend: { textStyle: { color: AXIS }, top: 0 },
    grid: { left: 56, right: 48, top: 36, bottom: 28 },
    xAxis: { type: "category", data: points.map((item) => item.label), axisLabel: { color: AXIS } },
    yAxis: [
      { type: "value", name: "花费", alignTicks: false, axisLabel: { color: AXIS, formatter: (value: number) => fmtHkd(value) }, splitLine: { lineStyle: { color: "rgba(138,163,153,0.15)" } } },
      { type: "value", name: "转化", alignTicks: false, axisLabel: { color: AXIS }, splitLine: { show: false } },
    ],
    series: [
      { name: "SEM 花费", type: "line", smooth: true, areaStyle: { color: "rgba(61,222,200,0.25)" }, data: points.map((item) => item.semCost), lineStyle: { color: TEAL } },
      { name: "Facebook 花费", type: "line", smooth: true, areaStyle: { color: "rgba(226,182,87,0.2)" }, data: points.map((item) => item.fbCost), lineStyle: { color: GOLD } },
      { name: "SEM 转化", type: "scatter", yAxisIndex: 1, symbolSize: 12, data: points.map((item) => item.semConversion), itemStyle: { color: TEAL, shadowBlur: 8, shadowColor: TEAL } },
      { name: "Facebook 转化", type: "scatter", yAxisIndex: 1, symbolSize: 12, data: points.map((item) => item.fbConversion), itemStyle: { color: CORAL, shadowBlur: 8, shadowColor: CORAL } },
    ],
  }
}

export function socialRadar(block: DashboardView["social"][number]): EChartsOption {
  const metrics = block.metrics.filter((metric) => !metric.rate && metric.value !== null)
  const max = Math.max(...metrics.map((metric) => Math.max(metric.value ?? 0, metric.ytd ?? 0)), 1)
  return {
    ...base(),
    legend: { top: 4, left: "center", itemGap: 28, textStyle: { color: AXIS, fontSize: 12 } },
    radar: {
      center: ["50%", "60%"],
      radius: "50%",
      axisNameGap: 16,
      indicator: metrics.map((metric) => ({ name: metric.label, max })),
      axisName: { color: AXIS, fontSize: 12, padding: [4, 6] },
      splitLine: { lineStyle: { color: "rgba(61,222,200,0.2)" } },
      splitArea: { areaStyle: { color: ["rgba(61,222,200,0.05)", "transparent"] } },
    },
    series: [
      {
        type: "radar",
        data: [
          { name: "本月", value: metrics.map((metric) => metric.value ?? 0), areaStyle: { color: "rgba(61,222,200,0.28)" }, lineStyle: { color: TEAL } },
          { name: "本年累计", value: metrics.map((metric) => metric.ytd ?? 0), areaStyle: { color: "rgba(226,182,87,0.18)" }, lineStyle: { color: GOLD } },
        ],
      },
    ],
  }
}

export function reconcileScatter(view: DashboardView): EChartsOption {
  const rows = view.reconciliation.filter((row) => row.list !== null && row.report !== null)
  return {
    ...base(),
    grid: { left: 56, right: 24, top: 24, bottom: 36 },
    xAxis: { name: "名单", nameTextStyle: { color: AXIS }, axisLabel: { color: AXIS }, splitLine: { lineStyle: { color: "rgba(138,163,153,0.15)" } } },
    yAxis: { name: "销售报表", nameTextStyle: { color: AXIS }, axisLabel: { color: AXIS }, splitLine: { lineStyle: { color: "rgba(138,163,153,0.15)" } } },
    series: [
      {
        type: "scatter",
        symbolSize: 18,
        data: rows.map((row) => ({ name: row.label, value: [row.list, row.report] })),
        itemStyle: { color: GOLD, shadowBlur: 10, shadowColor: GOLD },
        label: { show: true, formatter: "{b}", color: INK, position: "top" },
        markLine: {
          symbol: "none",
          lineStyle: { type: "dashed", color: TEAL },
          data: [[{ coord: [0, 0] }, { coord: ["max", "max"] }]],
        },
      },
    ],
  }
}
