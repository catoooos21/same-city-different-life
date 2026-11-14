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
  return METRICS.filter((m) => !m.basic)
    .map((m) => a.results[m.id])
    .filter((r): r is MetricResult => !!r && r.shown && r.trend !== null)
}

/** The plain variables (average temperature, daytime high, night-time low, yearly rain), in config order. */
export function basicMetrics(a: CityAnalysis): MetricResult[] {
  return METRICS.filter((m) => m.basic)
    .map((m) => a.results[m.id])
    .filter((r): r is MetricResult => !!r && r.trend !== null)
}

/**
 * Metrics that read the same underlying signal, so that five heat metrics moving together are
 * reported as one finding and not five.
 */
export const CASE_GROUPS: { id: string; title: string; note: string; metrics: string[] }[] = [
  {
    id: 'heat',
    title: 'Heat and cold',
    note: 'These all come from the same daily temperatures, so when they move together it is one signal, not several.',
    metrics: ['hot_days', 'very_hot_days', 'hot_nights', 'tropical_nights', 'heatwave_days', 'frost_days'],
  },
  {
    id: 'rain',
    title: 'Rain',
    note: 'These all come from the same daily rain, the least certain part of this data. “A second opinion on rain”, further down, checks them against NASA’s rain satellites.',
    metrics: ['rainy_days', 'heavy_rain_days', 'biggest_downpour', 'longest_dry_spell'],
  },
  {
    id: 'comfort',
    title: 'Comfort outdoors',
    note: 'These mix temperature, rain and humidity, so they partly repeat the two groups above.',
    metrics: ['sticky_days', 'perfect_days', 'training_days'],
  },
]

export interface CaseGroup {
  id: string
  title: string
  note: string
  /** Ranked: real changes first, strongest evidence first. */
  cases: MetricResult[]
  real: number
}

/** Cases split into the groups above (empty groups dropped); anything unlisted goes to a last "Other" group. */
export function groupCases(cases: MetricResult[]): CaseGroup[] {
  const out: CaseGroup[] = []
  const used = new Set<string>()
  for (const g of CASE_GROUPS) {
    const mine = rankCases(cases.filter((r) => g.metrics.includes(r.def.id)))
    mine.forEach((r) => used.add(r.def.id))
    if (mine.length) out.push({ id: g.id, title: g.title, note: g.note, cases: mine, real: mine.filter((r) => r.trend!.significant).length })
  }
  const rest = rankCases(cases.filter((r) => !used.has(r.def.id)))
  if (rest.length) out.push({ id: 'other', title: 'Other', note: '', cases: rest, real: rest.filter((r) => r.trend!.significant).length })
  return out
}

/** How one metric's trend compares between two places. */
export type Match = 'same' | 'opposite' | 'onlyA' | 'onlyB' | 'neither' | 'missing'

/** 'missing' when the metric does not happen (or has no trend test) in one of the two places. */
export function matchCalls(a: Call | null, b: Call | null): Match {
  if (a === null || b === null) return 'missing'
  if (a === 'none' && b === 'none') return 'neither'
  if (a === 'none') return 'onlyB'
  if (b === 'none') return 'onlyA'
  return a === b ? 'same' : 'opposite'
}

export interface ComparedMetric {
  id: string
  a: MetricResult | null
  b: MetricResult | null
  match: Match
}

/** The basics, then every card metric that makes a case in at least one of the two cities, in config order. */
export function compareCities(a: CityAnalysis, b: CityAnalysis): ComparedMetric[] {
  const inA = new Map([...basicMetrics(a), ...caseMetrics(a)].map((r) => [r.def.id, r]))
  const inB = new Map([...basicMetrics(b), ...caseMetrics(b)].map((r) => [r.def.id, r]))
  return METRICS.filter((m) => inA.has(m.id) || inB.has(m.id)).map((m) => {
    const ra = inA.get(m.id) ?? null
    const rb = inB.get(m.id) ?? null
    return { id: m.id, a: ra, b: rb, match: matchCalls(ra ? callOf(ra) : null, rb ? callOf(rb) : null) }
  })
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
