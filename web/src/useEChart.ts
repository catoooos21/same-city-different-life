import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'

/** Minimal echarts hook: returns a ref for the container div and re-applies the option on change. */
export function useEChart(option: echarts.EChartsOption) {
  const ref = useRef<HTMLDivElement>(null)
  const chart = useRef<echarts.ECharts | null>(null)
  useEffect(() => {
    if (!ref.current) return
    const c = echarts.init(ref.current)
    chart.current = c
    c.setOption(option, true)
    const ro = new ResizeObserver(() => c.resize())
    ro.observe(ref.current)
    return () => {
      ro.disconnect()
      c.dispose()
      chart.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    chart.current?.setOption(option, true)
  }, [option])
  return ref
}
