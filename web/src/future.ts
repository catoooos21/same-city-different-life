/**
 * "Two futures": straight-line what-ifs for a childhood that has not happened yet.
 *
 * NOT a forecast. Both futures start from where the long-term trend line stands in the last
 * year of data and continue it: one at the same pace as 1981-2025, one at a slower pace.
 * Only metrics with a real (significant) trend get a what-if.
 */
import { CHILDHOOD_LENGTH, YEARS } from './config/metrics'
import type { MetricResult } from './metrics'

/** Birth years the visitor can pick for the future kid. */
export const FUTURE_BIRTH_YEARS = [2030, 2040, 2050]
/** Pace of the second future, as a fraction of the 1981-2025 pace. */
export const SLOWER_PACE = 0.5

export interface WhatIf {
  value: number
  /** Same line drawn with the two ends of the 95 % confidence interval on the slope. */
  lo: number
  hi: number
}

function clamp(r: MetricResult, v: number): number {
  return r.def.unit === 'days' ? Math.max(0, Math.min(366, v)) : Math.max(0, v)
}

/**
 * Average over the first ten years of someone born in `birthYear`, if the trend continues at
 * `pace` times its 1981-2025 rate after the last year of data. Null when there is no real trend.
 */
export function whatIf(r: MetricResult, birthYear: number, pace = 1): WhatIf | null {
  const t = r.trend
  if (!t || !t.significant) return null
  const start = t.intercept + t.slope * YEARS.last
  const ahead = birthYear + (CHILDHOOD_LENGTH - 1) / 2 - YEARS.last
  const at = (slope: number) => clamp(r, start + slope * pace * ahead)
  const a = at(t.ci[0])
  const b = at(t.ci[1])
  return { value: at(t.slope), lo: Math.min(a, b), hi: Math.max(a, b) }
}
