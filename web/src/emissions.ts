/**
 * Where a country stands, judged on the one thing its own rules can change: its CO2 pollution.
 *
 * The weather on the rest of the page follows what the whole world burns, so it cannot tell us
 * whether one country is doing well. Its own emissions can. We run the app's trend test
 * (Mann-Kendall, Sen's slope) on the last ten years of the country's yearly CO2 and sort it:
 *
 *   IMPROVING      its CO2 fell steadily over the ten years.
 *   STARTING       not falling yet, but either its CO2 has levelled off (no steady trend and
 *                  within LEVEL_BAND_PCT of ten years ago, or lower), or it set its first
 *                  net-zero target in 2020 or later (countries written up in config/actions.ts).
 *   GETTING WORSE  its CO2 is still climbing, with no recent start that we know of.
 *
 * Data: Global Carbon Budget via Our World in Data (not NASA), built by scripts/build_emissions.mjs.
 */
import { annualTrend } from './stats'
import type { ActionStage } from './config/actions'

export const WINDOW_YEARS = 10
/** A country with no steady trend counts as "levelled off" when its trend line rose by less than this. */
export const LEVEL_BAND_PCT = 5

export interface EmissionsFile {
  builtAt: string
  source: string
  url: string
  years: number[]
  /** Country (GeoNames English name) -> million tonnes of CO2 per year, aligned with `years`. */
  countries: Record<string, (number | null)[]>
}

export type Standing = 'improving' | 'starting' | 'worse'
/** What the ten years of CO2 show on their own. */
export type Co2Call = 'falling' | 'levelled' | 'rising'

export const STANDING_LABEL: Record<Standing, string> = {
  improving: 'Improving',
  starting: 'Starting',
  worse: 'Getting worse',
}

export interface Co2Trend {
  call: Co2Call
  /** First and last year of the ten-year window. */
  from: number
  to: number
  /** Change along the trend line across the window, in percent of its starting level. */
  changePct: number
  /** p-value of the trend test. */
  p: number
}

export function co2Trend(years: number[], values: (number | null)[]): Co2Trend | null {
  const n = years.length
  if (n < WINDOW_YEARS || values.length !== n) return null
  const wy = years.slice(n - WINDOW_YEARS)
  const wv = values.slice(n - WINDOW_YEARS)
  const t = annualTrend(wy, wv)
  if (!t) return null
  const start = t.intercept + t.slope * wy[0]
  const end = t.intercept + t.slope * wy[wy.length - 1]
  const changePct = start > 0 ? ((end - start) / start) * 100 : 0
  let call: Co2Call
  if (t.significant) call = t.slope < 0 ? 'falling' : 'rising'
  else call = changePct < LEVEL_BAND_PCT ? 'levelled' : 'rising'
  return { call, from: wy[0], to: wy[wy.length - 1], changePct, p: t.p }
}

export interface Verdict extends Co2Trend {
  standing: Standing
  /** True when "starting" comes from new rules while the CO2 is still rising. */
  newRulesOnly: boolean
}

/** The stamp: CO2 first, then (only when it is not falling) whether the country has recently started acting. */
export function verdictOf(trend: Co2Trend, stage?: ActionStage): Verdict {
  if (trend.call === 'falling') return { ...trend, standing: 'improving', newRulesOnly: false }
  if (trend.call === 'levelled') return { ...trend, standing: 'starting', newRulesOnly: false }
  if (stage === 'recent') return { ...trend, standing: 'starting', newRulesOnly: true }
  return { ...trend, standing: 'worse', newRulesOnly: false }
}

export function countryVerdict(file: EmissionsFile, country: string, stage?: ActionStage): Verdict | null {
  const values = file.countries[country]
  const trend = values ? co2Trend(file.years, values) : null
  return trend ? verdictOf(trend, stage) : null
}

/** "about 12 % lower than in 2016", in plain words. */
export function changeWords(t: Co2Trend): string {
  const pct = Math.round(Math.abs(t.changePct))
  if (pct < 1) return `about the same as in ${t.from}`
  return `about ${pct} % ${t.changePct < 0 ? 'lower' : 'higher'} than in ${t.from}`
}

/** The one sentence next to the stamp. */
export function verdictSentence(v: Verdict): string {
  const change = changeWords(v)
  if (v.standing === 'improving') return `Its CO₂ pollution is falling steadily: ${change}.`
  if (v.standing === 'worse') return `Its CO₂ pollution is still climbing: ${change}.`
  if (v.newRulesOnly) return `It has started acting, but the rules are new and its CO₂ pollution has not turned yet: ${change}.`
  return v.changePct <= -LEVEL_BAND_PCT ? `Its CO₂ pollution has stopped climbing and is dipping, though not steadily yet: ${change}.` : `Its CO₂ pollution has stopped climbing: ${change}.`
}
