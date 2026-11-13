import { useMemo } from 'react'
import type { EChartsOption } from 'echarts'
import { useEChart } from '../useEChart'
import { useLang } from '../lang'
import type { GlobalComparison, Num, Variable } from '../types'
import { fmt } from './Bits'

const INK = '#2b2118'
const RED = '#a4262c'
const BLUE = '#1f5f8b'
const GREY = '#9a9285'

function Chart({ option, height }: { option: EChartsOption; height: number }) {
  const ref = useEChart(option)
  return <div ref={ref} style={{ width: '100%', height }} role="img" />
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

export function AnnualTrendChart({ v }: { v: Variable }) {
  const { t } = useLang()
  const option = useMemo<EChartsOption>(() => {
    const years = v.annual.years
    const vals = v.annual.values
    const tr = v.trend ?? { slope_per_decade: null, intercept: null, ci95_per_decade: null }
    const pairs = years.map((y, i) => [y, vals[i]] as [number, Num]).filter((p) => p[1] !== null) as [number, number][]
    const my = pairs.length ? mean(pairs.map((p) => p[0])) : 0
    const mv = pairs.length ? mean(pairs.map((p) => p[1])) : 0
    const slopeY = tr.slope_per_decade !== null ? tr.slope_per_decade / 10 : null
    const sen = years.map((y) =>
      slopeY !== null && tr.intercept !== null ? tr.intercept + slopeY * y : null,
    )
    const ci = tr.ci95_per_decade
    const hasCi = ci !== null && ci[0] !== null && ci[1] !== null && pairs.length > 0
    const lo = hasCi ? years.map((y) => mv + (ci![0]! / 10) * (y - my)) : []
    const hi = hasCi ? years.map((y) => mv + (ci![1]! / 10) * (y - my)) : []
    const series: unknown[] = []
    if (hasCi) {
      // CI band as one polygon: along `lo` left-to-right, back along `hi`.
      const poly = [...years.map((y, i) => [y, lo[i]]), ...years.map((y, i) => [y, hi[i]]).reverse()]
      series.push({
        type: 'custom', name: '95% CI', silent: true, tooltip: { show: false }, z: 1,
        data: [0],
        renderItem: (_p: unknown, api: { coord: (xy: number[]) => number[] }) => ({
          type: 'polygon', shape: { points: poly.map((pt) => api.coord(pt)) },
          style: { fill: RED, opacity: 0.16 },
        }),
      })
    }
    series.push({
      type: 'line', name: "Sen's slope", data: years.map((y, i) => [y, sen[i]]), symbol: 'none',
      lineStyle: { color: RED, width: 2.5 }, z: 2,
    })
    series.push({
      type: 'scatter', name: v.label, data: years.map((y, i) => [y, vals[i]]), symbolSize: 8, itemStyle: { color: INK }, z: 3,
    })
    const all = [...pairs.map((p) => p[1]), ...lo, ...hi].filter((x) => Number.isFinite(x))
    const ymin = all.length ? Math.min(...all) : 0
    const ymax = all.length ? Math.max(...all) : 1
    const pad = (ymax - ymin) * 0.15 || 1
    return {
      animation: false,
      grid: { left: 56, right: 16, top: 16, bottom: 32 },
      tooltip: { trigger: 'axis', valueFormatter: (x: unknown) => (typeof x === 'number' ? x.toFixed(3) : String(x)) },
      xAxis: { type: 'value', min: years[0] - 0.5, max: years[years.length - 1] + 0.5, axisLabel: { color: INK, formatter: (x: number) => String(Math.round(x)) }, splitLine: { show: false } },
      yAxis: {
        type: 'value', min: Math.floor((ymin - pad) * 10) / 10, max: Math.ceil((ymax + pad) * 10) / 10,
        name: v.unit, nameTextStyle: { color: INK },
        axisLabel: { color: INK }, splitLine: { lineStyle: { color: '#d9cfbd' } },
      },
      series: series as EChartsOption['series'],
    }
  }, [v])
  return (
    <figure className="chart">
      <figcaption>
        <h3>{t('chartAnnual')}</h3>
        <p className="note">{t('chartAnnualNote')}</p>
      </figcaption>
      <Chart option={option} height={300} />
    </figure>
  )
}

export function MonthlyChart({ v }: { v: Variable }) {
  const { t } = useLang()
  const pv = v.preview_2026
  const option = useMemo<EChartsOption>(() => {
    const dates = [...v.monthly_anomaly.dates, ...(pv ? pv.dates : [])]
    const base = v.monthly_anomaly.values
    const series: unknown[] = [
      { type: 'line', name: v.label, data: base, symbol: 'none', lineStyle: { color: INK, width: 1 }, connectNulls: false },
    ]
    if (pv) {
      const pad: Num[] = new Array(base.length).fill(null)
      series.push({
        type: 'line', name: t('preview2026'), data: [...pad, ...(pv.anomaly ?? [])], symbol: 'circle', symbolSize: 4,
        lineStyle: { color: GREY, width: 1, type: 'dashed' }, itemStyle: { color: GREY },
      })
    }
    return {
      animation: false,
      grid: { left: 52, right: 16, top: 28, bottom: 56 },
      legend: pv ? { top: 0, textStyle: { color: INK } } : undefined,
      tooltip: { trigger: 'axis' },
      dataZoom: [{ type: 'inside' }, { type: 'slider', height: 16, bottom: 6 }],
      xAxis: { type: 'category', data: dates, axisLabel: { color: INK } },
      yAxis: {
        type: 'value', scale: true, name: v.unit, nameTextStyle: { color: INK },
        axisLabel: { color: INK }, splitLine: { lineStyle: { color: '#d9cfbd' } },
      },
      series: series as EChartsOption['series'],
    }
  }, [v, pv, t])
  return (
    <figure className="chart">
      <figcaption>
        <h3>{t('chartMonthly')}</h3>
        <p className="note">
          {t('chartMonthlyNote')}
          {pv ? ' ' + t('previewNote') : ''}
        </p>
      </figcaption>
      <Chart option={option} height={280} />
    </figure>
  )
}

export function HeatStrip({ v }: { v: Variable }) {
  const { t } = useLang()
  const option = useMemo<EChartsOption>(() => {
    const hs = v.heat_strip
    const months = t('months').split(',')
    const cells: [number, number, number][] = []
    const nums: number[] = []
    hs.values.forEach((row, yi) =>
      row.forEach((val, mi) => {
        if (val !== null) {
          cells.push([yi, mi, val])
          nums.push(val)
        }
      }),
    )
    const lo = nums.length ? Math.min(...nums) : 0
    const hi = nums.length ? Math.max(...nums) : 0
    // Diverging scale centred on 0 when the data straddle it, otherwise on the mean.
    const centre = lo < 0 && hi > 0 ? 0 : nums.length ? mean(nums) : 0
    const half = Math.max(hi - centre, centre - lo) || 1
    return {
      animation: false,
      grid: { left: 56, right: 16, top: 8, bottom: 64 },
      tooltip: {
        formatter: (p: unknown) => {
          const d = (p as { data: [number, number, number] }).data
          return `${hs.years[d[0]]} ${months[d[1]]}: ${d[2].toFixed(2)} ${v.unit}`
        },
      },
      xAxis: { type: 'category', data: hs.years, splitArea: { show: false }, axisLabel: { color: INK, interval: 'auto' } },
      yAxis: { type: 'category', data: months, inverse: true, axisLabel: { color: INK } },
      visualMap: {
        min: centre - half, max: centre + half, calculable: false, orient: 'horizontal', left: 'center', bottom: 4,
        itemWidth: 12, itemHeight: 160, textStyle: { color: INK },
        inRange: { color: ['#1f5f8b', '#8fb8d6', '#f7f1e3', '#e8956b', '#a4262c'] },
      },
      series: [{ type: 'heatmap', data: cells, itemStyle: { borderColor: '#f7f1e3', borderWidth: 1 } }],
    }
  }, [v, t])
  const months = t('months').split(',')
  const pm = v.per_month_trends ?? {}
  const sig = Object.entries(pm)
    .filter(([, r]) => r && r.significant)
    .sort((a, b) => Math.abs(b[1]!.slope_per_decade ?? 0) - Math.abs(a[1]!.slope_per_decade ?? 0))
  return (
    <figure className="chart">
      <figcaption>
        <h3>{t('chartStrip')}</h3>
        <p className="note">{t('chartStripNote')}</p>
      </figcaption>
      <Chart option={option} height={340} />
      <p className="note">
        {sig.length === 0
          ? t('sigMonthsNone')
          : <>{t('sigMonths')} {sig.map(([m, r]) => `${months[Number(m) - 1]} (${(r!.slope_per_decade ?? 0) > 0 ? '+' : ''}${fmt(r!.slope_per_decade, 2)} ${v.unit})`).join(', ')}.</>}
      </p>
    </figure>
  )
}

export function VsWorld({ g, kuwait }: { g: GlobalComparison; kuwait: Variable }) {
  const { t } = useLang()
  const option = useMemo<EChartsOption>(() => {
    // Both series are annual anomalies vs the same baseline, computed by the pipeline.
    const years = g.years
    const idx = new Map(kuwait.annual_anomaly.years.map((y, i) => [y, kuwait.annual_anomaly.values[i]]))
    const kv = years.map((y) => idx.get(y) ?? null)
    return {
      animation: false,
      grid: { left: 52, right: 16, top: 32, bottom: 32 },
      legend: { top: 0, textStyle: { color: INK } },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: years, axisLabel: { color: INK } },
      yAxis: { type: 'value', scale: true, axisLabel: { color: INK }, splitLine: { lineStyle: { color: '#d9cfbd' } } },
      series: [
        { type: 'line', name: t('kuwaitSeries'), data: kv, symbol: 'circle', symbolSize: 5, lineStyle: { color: RED }, itemStyle: { color: RED } },
        { type: 'line', name: t('globalSeries') + ' (' + g.source + ')', data: g.anomaly, symbol: 'circle', symbolSize: 5, lineStyle: { color: BLUE }, itemStyle: { color: BLUE } },
      ],
    }
  }, [g, kuwait, t])
  const gs = g.trend?.slope_per_decade ?? null
  const ks = g.kuwait_slope_per_decade
  return (
    <figure className="chart">
      <figcaption>
        <h3>{t('vsWorld')}</h3>
        <p className="note">{t('vsWorldNote')} {g.note}</p>
        <p className="big-stat">
          {t('ratio')}:{' '}
          <strong>{g.ratio_kuwait_to_global === null ? '-' : g.ratio_kuwait_to_global.toFixed(1) + '×'}</strong>
          <small>
            {' '}({t('kuwaitSeries')} {ks === null ? '-' : (ks > 0 ? '+' : '') + ks.toFixed(2)} °C/decade,{' '}
            {t('globalSeries')} {gs === null ? '-' : (gs > 0 ? '+' : '') + gs.toFixed(2)} °C/decade)
          </small>
        </p>
      </figcaption>
      <Chart option={option} height={260} />
    </figure>
  )
}

export interface ConnectedFile {
  x: { id: string; label: string; label_ar?: string; unit: string }
  y: { id: string; label: string; label_ar?: string; unit: string }
  pairs: { years: number[]; x: Num[]; y: Num[] }
  correlation: { n: number; pearson_r: number; pearson_p: number; r_ci95: [number, number]; spearman_rho: number; spearman_p: number } | null
  correlation_detrended: { n: number; pearson_r: number; pearson_p: number; r_ci95: [number, number] } | null
}

export function ConnectedScatter({ f }: { f: ConnectedFile }) {
  const { t, pick } = useLang()
  const option = useMemo<EChartsOption>(() => {
    const pts = f.pairs.years
      .map((y, i) => [f.pairs.x[i], f.pairs.y[i], y] as [Num, Num, number])
      .filter((p): p is [number, number, number] => p[0] !== null && p[1] !== null)
    const c = f.correlation
    let fit: number[][] = []
    if (c && pts.length > 2) {
      const mx = mean(pts.map((p) => p[0]))
      const my = mean(pts.map((p) => p[1]))
      const sx = Math.sqrt(mean(pts.map((p) => (p[0] - mx) ** 2)))
      const sy = Math.sqrt(mean(pts.map((p) => (p[1] - my) ** 2)))
      const slope = sx > 0 ? c.pearson_r * (sy / sx) : 0
      const xs = pts.map((p) => p[0])
      const x0 = Math.min(...xs)
      const x1 = Math.max(...xs)
      fit = [[x0, my + slope * (x0 - mx)], [x1, my + slope * (x1 - mx)]]
    }
    return {
      animation: false,
      grid: { left: 60, right: 16, top: 16, bottom: 44 },
      tooltip: { formatter: (p: unknown) => { const d = (p as { data: number[] }).data; return d.length === 3 ? `${d[2]}: ${d[0].toFixed(2)}, ${d[1].toFixed(3)}` : '' } },
      xAxis: { type: 'value', name: `${pick(f.x.label, f.x.label_ar)} (${f.x.unit})`, nameLocation: 'middle', nameGap: 28, scale: true, axisLabel: { color: INK }, splitLine: { lineStyle: { color: '#d9cfbd' } } },
      yAxis: { type: 'value', name: f.y.unit, scale: true, axisLabel: { color: INK }, splitLine: { lineStyle: { color: '#d9cfbd' } } },
      series: [
        { type: 'scatter', data: pts, symbolSize: 9, itemStyle: { color: INK }, label: { show: true, formatter: (p: unknown) => String((p as { data: number[] }).data[2]).slice(2), position: 'top', fontSize: 9, color: GREY } },
        { type: 'line', data: fit, symbol: 'none', lineStyle: { color: RED, width: 2 }, silent: true },
      ],
    }
  }, [f, pick])
  const c = f.correlation
  const d = f.correlation_detrended
  return (
    <figure className="chart">
      <figcaption>
        <h3>{t('connectedChart')}</h3>
        <p className="note">{t('connectedNote')}</p>
      </figcaption>
      <Chart option={option} height={360} />
      {c && (
        <ul className="facts">
          <li><span>Pearson r</span><strong>{c.pearson_r.toFixed(2)} <small>[{c.r_ci95[0].toFixed(2)}, {c.r_ci95[1].toFixed(2)}] p {c.pearson_p < 0.001 ? '< 0.001' : c.pearson_p.toFixed(3)}</small></strong></li>
          <li><span>Spearman rho</span><strong>{c.spearman_rho.toFixed(2)} <small>p {c.spearman_p < 0.001 ? '< 0.001' : c.spearman_p.toFixed(3)}</small></strong></li>
          {d && <li><span>{t('detrended')}</span><strong>{d.pearson_r.toFixed(2)} <small>p {d.pearson_p < 0.001 ? '< 0.001' : d.pearson_p.toFixed(3)}</small></strong></li>}
          <li><span>{t('nLabel')}</span><strong>{c.n}</strong></li>
        </ul>
      )}
    </figure>
  )
}
