/**
 * Daily series -> annual series per metric -> trend + period comparison.
 */
import { BASELINE, CHILDHOOD_LENGTH, MAX_MISSING_FRACTION, METRICS, METRIC_BY_ID, THRESHOLDS, YEARS, type CityContext, type Day, type MetricDef, type Param } from './config/metrics'
import { annualTrend, percentile, type Trend } from './stats'
import type { DailySeries } from './power'

export interface Period {
  first: number
  last: number
}

export function childhood(birthYear: number): Period {
  return { first: birthYear, last: birthYear + CHILDHOOD_LENGTH - 1 }
}

export interface AnnualSeries {
  years: number[]
  values: (number | null)[]
  /** Fraction of missing days per year (for the methods panel). */
  missing: number[]
}

export interface MonthlySeries {
  /** [year][month] average count, null when the month has too many gaps. */
  years: number[]
  values: (number | null)[][]
}

export interface PeriodStat {
  mean: number | null
  validYears: number
  totalYears: number
}

export interface MetricResult {
  def: MetricDef
  annual: AnnualSeries
  trend: Trend | null
  slopePerDecade: number | null
  ciPerDecade: [number, number] | null
  baselineMean: number | null
  shown: boolean
  then: PeriodStat
  now: PeriodStat
  diff: number | null
  monthly?: MonthlySeries
}

// ---------- calendar helpers (leap years handled by Date.UTC) ----------

export interface Calendar {
  year: Int16Array
  month: Uint8Array // 0-11
  dayOfYear: Uint16Array
  yearStart: Map<number, number> // year -> index of Jan 1
  yearLength: Map<number, number>
}

let calendarCache: Calendar | null = null

export function calendar(n: number): Calendar {
  if (calendarCache && calendarCache.year.length === n) return calendarCache
  const year = new Int16Array(n)
  const month = new Uint8Array(n)
  const dayOfYear = new Uint16Array(n)
  const yearStart = new Map<number, number>()
  const yearLength = new Map<number, number>()
  let y = YEARS.first
  let i = 0
  while (i < n) {
    const len = isLeap(y) ? 366 : 365
    yearStart.set(y, i)
    yearLength.set(y, len)
    const monthLens = [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    let m = 0
    let dayInMonth = 0
    for (let d = 0; d < len && i < n; d++, i++) {
      year[i] = y
      month[i] = m
      dayOfYear[i] = d
      dayInMonth++
      if (dayInMonth === monthLens[m]) {
        m++
        dayInMonth = 0
      }
    }
    y++
  }
  calendarCache = { year, month, dayOfYear, yearStart, yearLength }
  return calendarCache
}

export function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

// ---------- city context ----------

export function cityContext(d: DailySeries): CityContext {
  const cal = calendar(d.n)
  const i0 = cal.yearStart.get(BASELINE.first)!
  const i1 = cal.yearStart.get(BASELINE.last)! + cal.yearLength.get(BASELINE.last)!
  return {
    p90max: percentile(d.values.T2M_MAX.subarray(i0, i1), THRESHOLDS.hotPercentile),
    p90min: percentile(d.values.T2M_MIN.subarray(i0, i1), THRESHOLDS.hotPercentile),
  }
}

// ---------- per-day evaluation ----------

function dayAt(d: DailySeries, i: number): Day {
  return {
    T2M_MAX: d.values.T2M_MAX[i],
    T2M_MIN: d.values.T2M_MIN[i],
    T2M: d.values.T2M[i],
    T2MDEW: d.values.T2MDEW[i],
    PRECTOTCORR: d.values.PRECTOTCORR[i],
    RH2M: d.values.RH2M[i],
  }
}

function missingMask(d: DailySeries, needs: Param[]): Uint8Array {
  const m = new Uint8Array(d.n)
  for (const p of needs) {
    const a = d.values[p]
    for (let i = 0; i < d.n; i++) if (Number.isNaN(a[i])) m[i] = 1
  }
  return m
}

/**
 * Compute the annual series for a metric.
 * A year is dropped (null) when more than MAX_MISSING_FRACTION of its days lack a needed parameter.
 */
export function annualSeries(def: MetricDef, d: DailySeries, ctx: CityContext): AnnualSeries {
  const cal = calendar(d.n)
  const miss = missingMask(d, def.needs)
  const years: number[] = []
  const values: (number | null)[] = []
  const missing: number[] = []

  // day-level flags for count / run kinds
  const flag = new Uint8Array(d.n)
  const c = def.compute
  if (c.kind === 'count' || c.kind === 'longest_run' || c.kind === 'run_days') {
    for (let i = 0; i < d.n; i++) if (!miss[i] && c.test(dayAt(d, i), ctx)) flag[i] = 1
  }
  // run_days: mark days inside runs >= minRun over the whole continuous series (runs may cross New Year)
  let inRun: Uint8Array | null = null
  if (c.kind === 'run_days') {
    inRun = new Uint8Array(d.n)
    let i = 0
    while (i < d.n) {
      if (flag[i]) {
        let j = i
        while (j + 1 < d.n && flag[j + 1]) j++
        if (j - i + 1 >= c.minRun) for (let k = i; k <= j; k++) inRun[k] = 1
        i = j + 1
      } else i++
    }
  }

  for (let y = YEARS.first; y <= YEARS.last; y++) {
    const i0 = cal.yearStart.get(y)!
    const len = cal.yearLength.get(y)!
    let nMiss = 0
    for (let i = i0; i < i0 + len; i++) nMiss += miss[i]
    const frac = nMiss / len
    years.push(y)
    missing.push(frac)
    if (frac > MAX_MISSING_FRACTION) {
      values.push(null)
      continue
    }
    let v = 0
    if (def.id === 'mean_temp') {
      let s = 0
      let k = 0
      for (let i = i0; i < i0 + len; i++) if (!miss[i]) (s += d.values.T2M[i]), k++
      v = k ? s / k : NaN
    } else if (c.kind === 'count') {
      for (let i = i0; i < i0 + len; i++) v += flag[i]
    } else if (c.kind === 'run_days') {
      for (let i = i0; i < i0 + len; i++) v += inRun![i]
    } else if (c.kind === 'max') {
      v = -Infinity
      for (let i = i0; i < i0 + len; i++) if (!miss[i]) v = Math.max(v, c.value(dayAt(d, i)))
    } else if (c.kind === 'longest_run') {
      let best = 0
      let run = 0
      for (let i = i0; i < i0 + len; i++) {
        if (flag[i]) {
          run++
          if (run > best) best = run
        } else run = 0
      }
      v = best
    }
    values.push(Number.isFinite(v) ? v : null)
  }
  return { years, values, missing }
}

/** Month-by-month counts for 'count' metrics (outdoor calendar). */
export function monthlySeries(def: MetricDef, d: DailySeries, ctx: CityContext): MonthlySeries {
  const cal = calendar(d.n)
  const miss = missingMask(d, def.needs)
  const c = def.compute
  const years: number[] = []
  const values: (number | null)[][] = []
  if (c.kind !== 'count') return { years, values }
  for (let y = YEARS.first; y <= YEARS.last; y++) {
    const i0 = cal.yearStart.get(y)!
    const len = cal.yearLength.get(y)!
    const counts = new Array(12).fill(0)
    const missing = new Array(12).fill(0)
    const days = new Array(12).fill(0)
    for (let i = i0; i < i0 + len; i++) {
      const m = cal.month[i]
      days[m]++
      if (miss[i]) missing[m]++
      else if (c.test(dayAt(d, i), ctx)) counts[m]++
    }
    years.push(y)
    values.push(counts.map((v, m) => (missing[m] / days[m] > MAX_MISSING_FRACTION ? null : v)))
  }
  return { years, values }
}

// ---------- periods ----------

export function periodStat(s: AnnualSeries, p: Period): PeriodStat {
  let sum = 0
  let k = 0
  let total = 0
  for (let i = 0; i < s.years.length; i++) {
    const y = s.years[i]
    if (y < p.first || y > p.last) continue
    total++
    const v = s.values[i]
    if (v !== null) (sum += v), k++
  }
  return { mean: k ? sum / k : null, validYears: k, totalYears: total }
}

export function periodMonthly(ms: MonthlySeries, p: Period): (number | null)[] {
  const out: (number | null)[] = []
  for (let m = 0; m < 12; m++) {
    let sum = 0
    let k = 0
    for (let i = 0; i < ms.years.length; i++) {
      const y = ms.years[i]
      if (y < p.first || y > p.last) continue
      const v = ms.values[i][m]
      if (v !== null) (sum += v), k++
    }
    out.push(k ? sum / k : null)
  }
  return out
}

// ---------- everything for one city ----------

export interface CityAnalysis {
  ctx: CityContext
  results: Record<string, MetricResult>
  then: Period
  now: Period
}

export function analyse(d: DailySeries, thenP: Period, nowP: Period, metricIds?: string[]): CityAnalysis {
  const ctx = cityContext(d)
  const results: Record<string, MetricResult> = {}
  const defs = metricIds ? metricIds.map((id) => METRIC_BY_ID[id]) : METRICS
  for (const def of defs) {
    const annual = annualSeries(def, d, ctx)
    const trend = annualTrend(annual.years, annual.values)
    const base = periodStat(annual, BASELINE)
    const thenS = periodStat(annual, thenP)
    const nowS = periodStat(annual, nowP)
    const r: MetricResult = {
      def,
      annual,
      trend,
      slopePerDecade: trend ? trend.slope * 10 : null,
      ciPerDecade: trend ? [trend.ci[0] * 10, trend.ci[1] * 10] : null,
      baselineMean: base.mean,
      shown: def.showIf ? base.mean !== null && def.showIf(base.mean) : true,
      then: thenS,
      now: nowS,
      diff: thenS.mean !== null && nowS.mean !== null ? nowS.mean - thenS.mean : null,
    }
    if (def.monthly) r.monthly = monthlySeries(def, d, ctx)
    results[def.id] = r
  }
  return { ctx, results, then: thenP, now: nowP }
}
