/**
 * The detective part: every metric of a city as one "case".
 * Pure helpers for the case file (all metrics, ranked by evidence).
 */
import { METRICS } from './config/metrics'
import type { CityAnalysis, MetricResult } from './metrics'

/** What the trend test says about one metric. */
export type Call = 'up' | 'down' | 'none'

/** 'up' / 'down' only for a significant trend; 'none' otherwise; null when no test could be run. */
export function callOf(r: MetricResult): Call | null {
  const t = r.trend
  if (!t) return null
  if (!t.significant) return 'none'
  if (t.direction === 'up' || t.direction === 'down') return t.direction
  return t.slope < 0 ? 'down' : 'up'
}

/** Metrics that make a case in this city: happens here, has a trend test, is a card metric. Config order. */
export function caseMetrics(a: CityAnalysis): MetricResult[] {
  return METRICS.filter((m) => m.id !== 'mean_temp')
    .map((m) => a.results[m.id])
    .filter((r): r is MetricResult => !!r && r.shown && r.trend !== null)
}

/** Real changes first, then by how strong the evidence is (|Z| of the Mann-Kendall test). */
export function rankCases(cases: MetricResult[]): MetricResult[] {
  return [...cases].sort((x, y) => {
    const sx = x.trend!.significant ? 1 : 0
    const sy = y.trend!.significant ? 1 : 0
    if (sx !== sy) return sy - sx
    return Math.abs(y.trend!.z) - Math.abs(x.trend!.z)
  })
}
