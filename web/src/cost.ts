/**
 * What the heat costs: the weather numbers that money follows, computed from the same NASA data
 * as the rest of the page. The page cannot count money itself (that depends on jobs, buildings and
 * prices), so the money figures shown next to these are published studies, quoted with their source.
 */
import { BASELINE, METRIC_BY_ID, type MetricDef } from './config/metrics'
import { annualSeries, periodStat, type CityAnalysis, type MetricResult } from './metrics'
import type { DailySeries } from './power'
import { annualTrend } from './stats'

/** Degree days are counted from this daily mean temperature, the usual base for both heating and cooling. */
export const DEGREE_DAY_BASE_C = 18
/** Heating is shown only where a typical baseline year needs at least this much. */
export const HEATING_SHOWN_FROM = 100

/** The weather engine only knows days, mm and °C; the shared wording code prints any other unit as it is. */
const DEGREE_DAYS = 'degree-days' as MetricDef['unit']

export const COOLING: MetricDef = {
  id: 'cooling_need',
  name: 'Cooling need',
  plain: 'How much, and how often, the day is warmer than 18 °C. Air-conditioning use follows it.',
  unit: DEGREE_DAYS,
  unitLong: 'cooling degree-days a year',
  needs: ['T2M'],
  definition: `Cooling degree days: for every day, the daily mean temperature minus ${DEGREE_DAY_BASE_C} °C when it is above ${DEGREE_DAY_BASE_C} °C, added up over the year. A standard measure of how much cooling buildings need.`,
  compute: { kind: 'sum', value: (d) => Math.max(0, d.T2M - DEGREE_DAY_BASE_C) },
}

export const HEATING: MetricDef = {
  id: 'heating_need',
  name: 'Heating need',
  plain: 'How much, and how often, the day is colder than 18 °C. Heating use follows it.',
  unit: DEGREE_DAYS,
  unitLong: 'heating degree-days a year',
  needs: ['T2M'],
  definition: `Heating degree days: for every day, ${DEGREE_DAY_BASE_C} °C minus the daily mean temperature when it is below ${DEGREE_DAY_BASE_C} °C, added up over the year. Shown only where a typical year needs at least ${HEATING_SHOWN_FROM}.`,
  showIf: (m) => m >= HEATING_SHOWN_FROM,
  compute: { kind: 'sum', value: (d) => Math.max(0, DEGREE_DAY_BASE_C - d.T2M) },
}

/** One extra measure through the same yearly-series code, trend test and periods as the page. */
export function costResult(def: MetricDef, d: DailySeries, a: CityAnalysis): MetricResult {
  const annual = annualSeries(def, d, a.ctx)
  const trend = annualTrend(annual.years, annual.values)
  const base = periodStat(annual, BASELINE)
  const thenS = periodStat(annual, a.then)
  const nowS = periodStat(annual, a.now)
  return {
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
}

export interface CostRow {
  result: MetricResult
  /** What this number has to do with money, in one line. */
  money: string
}

/** Hot-workday measures the page already computes, reused here with what they mean for work. */
const WORK_IDS: { id: string; money: string }[] = [
  { id: 'very_hot_days', money: 'Days when outdoor work slows down or stops.' },
  { id: 'heatwave_days', money: 'Several hot days in a row strain power grids, crops and health services.' },
]

/** The rows of the section: cooling, heating where it matters, then the hot-day counts that happen here. */
export function costRows(d: DailySeries, a: CityAnalysis): CostRow[] {
  const rows: CostRow[] = [
    { result: costResult(COOLING, d, a), money: 'More cooling need means more electricity for air conditioning.' },
    { result: costResult(HEATING, d, a), money: 'Less heating need saves fuel: the other side of the bill.' },
  ]
  for (const w of WORK_IDS) {
    const r = a.results[w.id]
    if (r && METRIC_BY_ID[w.id]) rows.push({ result: r, money: w.money })
  }
  return rows.filter((r) => r.result.shown && r.result.trend !== null)
}

/** Then-to-now change of a measure in percent of then; null when it cannot be said (no data, or then is about zero). */
export function percentChange(r: MetricResult): number | null {
  const a = r.then.mean
  const b = r.now.mean
  if (a === null || b === null || Math.abs(a) < 1) return null
  return ((b - a) / a) * 100
}

/** Published estimates of what heat costs. Not computed here; each is quoted with its source. */
export interface Study {
  figure: string
  what: string
  source: string
  url: string
}

export const STUDIES: Study[] = [
  {
    figure: 'US$835 billion',
    what: 'Income that could not be earned in 2023 because it was too hot to work: 512 billion working hours worldwide, the most on record.',
    source: 'The Lancet Countdown on health and climate change, 2024 report',
    url: 'https://researchonline.lse.ac.uk/id/eprint/125929/',
  },
  {
    figure: 'US$2,400 billion a year by 2030',
    what: 'Expected yearly loss from heat at work: 2.2 % of all working hours in the world, the same as 80 million full-time jobs. Farming and construction lose the most.',
    source: 'International Labour Organization, Working on a Warmer Planet (2019)',
    url: 'https://www.ilo.org/resource/news/increase-heat-stress-predicted-bring-productivity-loss-equivalent-80',
  },
]
