/**
 * Country board: one row per country, measured at its largest city.
 *
 * Two separate things are shown side by side and never mixed:
 *  - WEATHER: what 45 years of NASA data show at that city (computed, with the app's trend test).
 *  - ACTION:  what the country has pledged or passed (context written by the team, config/actions.ts).
 * A country's rules cannot cool its own weather: the air is shared. So the board never says a
 * rule caused a weather change; it shows who is acting next to what the weather is doing.
 */
import { callOf, caseMetrics, type Call } from './casefile'
import type { CityAnalysis } from './metrics'
import { annualTrend } from './stats'
import gistemp from './data/gistemp.json'

/** Metrics where more is worse for daily life, and where more is better. Rain and frost are left neutral. */
export const MORE_IS_WORSE = ['hot_days', 'very_hot_days', 'hot_nights', 'tropical_nights', 'heatwave_days', 'sticky_days']
export const MORE_IS_BETTER = ['perfect_days', 'training_days']

export interface MetricCall {
  id: string
  call: Call
  /** Sen's slope per ten years (days or mm). */
  perDecade: number
}

/** What build_countries.mjs stores per country (plus country, city, lat, lon). */
export interface CountrySummary {
  /** Mean temperature trend, °C per ten years, and its p-value. */
  temp: { perDecade: number; p: number; significant: boolean } | null
  /** Hot days: average per year in 1981-1990 and 2016-2025. */
  hotDays: { then: number | null; now: number | null }
  metrics: MetricCall[]
}

export interface CountryRow extends CountrySummary {
  country: string
  city: string
  /** True when the city is the capital; false when it is the largest city instead. */
  capital: boolean
  lat: number
  lon: number
}

export function summarise(a: CityAnalysis): CountrySummary {
  const t = a.results.mean_temp
  const hot = a.results.hot_days
  return {
    temp: t?.trend ? { perDecade: round(t.slopePerDecade!, 3), p: round(t.trend.p, 4), significant: t.trend.significant } : null,
    hotDays: { then: hot ? roundOrNull(hot.then.mean) : null, now: hot ? roundOrNull(hot.now.mean) : null },
    metrics: caseMetrics(a).map((r) => ({ id: r.def.id, call: callOf(r)!, perDecade: round(r.slopePerDecade!, 2) })),
  }
}

function round(v: number, d: number): number {
  const k = Math.pow(10, d)
  return Math.round(v * k) / k
}
function roundOrNull(v: number | null): number | null {
  return v === null ? null : round(v, 1)
}

// ---------- weather category (from the data) ----------

const gistempTrend = annualTrend(gistemp.years, gistemp.values)
/** World warming rate over the same years, °C per ten years (NASA GISTEMP). */
export const WORLD_PER_DECADE = gistempTrend ? gistempTrend.slope * 10 : 0.2
/** Same threshold the "vs the world" line uses. */
export const FASTER_RATIO = 1.5

export type Weather = 'fast' | 'heating' | 'none' | 'cooling' | 'unknown'

export const WEATHER_LABEL: Record<Weather, string> = {
  fast: 'Heating faster than the world',
  heating: 'Heating',
  none: 'No clear change',
  cooling: 'Cooling',
  unknown: 'Not enough data',
}

export function weatherOf(s: CountrySummary, world = WORLD_PER_DECADE): Weather {
  const t = s.temp
  if (!t) return 'unknown'
  if (!t.significant) return 'none'
  if (t.perDecade < 0) return 'cooling'
  return world > 0 && t.perDecade / world >= FASTER_RATIO ? 'fast' : 'heating'
}

/** How many everyday-life metrics are really getting worse / really getting better at this city. */
export function lifeScore(s: CountrySummary): { worse: number; better: number } {
  let worse = 0
  let better = 0
  for (const m of s.metrics) {
    if (m.call === 'none') continue
    const up = m.call === 'up'
    if (MORE_IS_WORSE.includes(m.id)) up ? worse++ : better++
    else if (MORE_IS_BETTER.includes(m.id)) up ? better++ : worse++
  }
  return { worse, better }
}

export function countWeather(rows: CountrySummary[]): Record<Weather, number> {
  const out: Record<Weather, number> = { fast: 0, heating: 0, none: 0, cooling: 0, unknown: 0 }
  for (const r of rows) out[weatherOf(r)]++
  return out
}
