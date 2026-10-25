import { useEffect, useRef } from "react"
import * as echarts from "echarts"

export const AXIS = "#6f675e"
export const GOLD = "#a56b3c"
export const TEAL = "#2f6d52"
export const CORAL = "#9a4032"
export const INK = "#1c2430"
export const PALETTE = ["#2f6d52", "#a56b3c", "#1e3f34", "#9a4032", "#3d6f8a", "#8a6a3b", "#6e8b74", "#c47b62"]

export function base(): Pick<echarts.EChartsOption, "backgroundColor" | "animationDuration" | "animationEasing" | "textStyle" | "tooltip"> {
  return {
    backgroundColor: "transparent",
    animationDuration: 900,
    animationEasing: "cubicOut",
    textStyle: { fontFamily: "Noto Sans SC, PingFang SC, sans-serif", color: INK },
    tooltip: {
      backgroundColor: "rgba(251, 248, 243, 0.96)",
      borderColor: "#e4d8c8",
      textStyle: { color: INK, fontSize: 12 },
      confine: true,
    },
  }
}

type Props = {
  option: echarts.EChartsOption
  className?: string
  onClick?: (params: echarts.ECElementEvent) => void
}

export function EChart({ option, className = "h-80 w-full", onClick }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const chart = useRef<echarts.ECharts | null>(null)
  const clickRef = useRef(onClick)
  useEffect(() => {
    clickRef.current = onClick
  })

  useEffect(() => {
    if (!host.current) return
    const instance = echarts.init(host.current, undefined, { renderer: "canvas" })
    chart.current = instance
    const resize = () => instance.resize()
    const observer = new ResizeObserver(resize)
    observer.observe(host.current)
    instance.on("click", (params) => clickRef.current?.(params))
    return () => {
      observer.disconnect()
      instance.dispose()
      chart.current = null
    }
  }, [])

  useEffect(() => {
    chart.current?.setOption(option, { notMerge: true, lazyUpdate: true })
  }, [option])

  return <div ref={host} className={className} />
}
