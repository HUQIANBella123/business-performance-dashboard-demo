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

export function gaugeBoard(view: DashboardView): EChartsOption {
  const gauges = [
    { id: "sa", name: "新增转化" },
    { id: "sm", name: "验车转化" },
    { id: "rnsa", name: "续保转化" },
  ].map((item) => ({ ...item, kpi: findKpi(view, item.id) }))
  return {
    ...base(),
    series: gauges.map((item, index) => {
      const raw = item.kpi?.value
      const value = raw === null || raw === undefined ? 0 : Math.max(0, Math.min(raw * 100, 150))
      return {
        type: "gauge",
        center: [`${18 + index * 32}%`, "58%"],
        radius: "68%",
        min: 0,
        max: 100,
        progress: { show: true, width: 10, itemStyle: { color: PALETTE[index] } },
        axisLine: { lineStyle: { width: 10, color: [[1, "rgba(138,163,153,0.25)"]] } },
        axisTick: { show: false },
        splitLine: { length: 8, lineStyle: { color: AXIS } },
        axisLabel: { color: AXIS, distance: 12, fontSize: 10 },
        pointer: { itemStyle: { color: PALETTE[index] }, width: 4 },
        anchor: { show: true, size: 8, itemStyle: { color: GOLD } },
        title: { offsetCenter: [0, "78%"], color: INK, fontSize: 12 },
        detail: {
          valueAnimation: true,
          offsetCenter: [0, "48%"],
          color: INK,
          fontSize: 16,
          formatter: () => item.kpi?.display ?? "—",
        },
        data: [{ value, name: item.name }],
      }
    }),
  }
}

export function momentumOption(trend: TrendPoint[]): EChartsOption {
  const labels = trend.map((item) => item.label)
  return {
    ...base(),
    legend: { textStyle: { color: AXIS }, top: 0 },
    grid: { left: 48, right: 24, top: 36, bottom: 48 },
    dataZoom: [{ type: "inside" }, { type: "slider", height: 16, bottom: 8, borderColor: "transparent", textStyle: { color: AXIS } }],
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
    singleAxis: {
      type: "time",
      top: 48,
      bottom: 28,
      axisLabel: { color: AXIS },
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

export function productSankey(view: DashboardView): EChartsOption {
  const nodes = new Map<string, { name: string }>()
  const links: { source: string; target: string; value: number }[] = []
  const touch = (name: string) => {
    if (!nodes.has(name)) nodes.set(name, { name })
  }
  for (const row of view.products) {
    const mid = `${row.insurer}·${row.product}`
    touch(row.insurer)
    touch(mid)
    const online = Math.max(row.online, 0)
    const offline = Math.max(row.offline, 0)
    if (online + offline > 0) links.push({ source: row.insurer, target: mid, value: online + offline })
    if (online > 0) {
      touch("线上")
      links.push({ source: mid, target: "线上", value: online })
    }
    if (offline > 0) {
      touch("线下")
      links.push({ source: mid, target: "线下", value: offline })
    }
  }
  return {
    ...base(),
    series: [
      {
        type: "sankey",
        nodeAlign: "justify",
        draggable: true,
        emphasis: { focus: "adjacency" },
        lineStyle: { color: "gradient", curveness: 0.5, opacity: 0.45 },
        label: { color: INK },
        itemStyle: { borderWidth: 0 },
        data: [...nodes.values()],
        links,
      },
    ],
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
    legend: { bottom: 0, textStyle: { color: AXIS } },
    radar: {
      indicator: metrics.map((metric) => ({ name: metric.label, max })),
      axisName: { color: AXIS },
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
