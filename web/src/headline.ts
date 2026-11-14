/**
 * The one finding to lead with: the measure of this lens with the strongest evidence of change.
 * Pure, so the choice can be tested.
 */
import type { Lens, LensMetric } from './config/lenses'
import type { CityAnalysis, MetricResult } from './metrics'
import { hasGap, noteLine } from './notewords'

export interface Headline {
  lm: LensMetric
  r: MetricResult
  /** The then-vs-now sentence, e.g. "37 more unusually hot days, every year." */
  line: string
  /** Did it get worse for this life? */
  worse: boolean
  /** Lens measures with a real (significant) change, and how many were checked. */
  real: number
  total: number
}

/**
 * Among the measures shown for this lens: a real change, with a gap between the two lives that
 * goes the same way as the long-term trend. The strongest trend test wins, with rain-only measures
 * leading only when no other measure qualifies. Null when nothing qualifies,
 * so the page never leads with a number the stamp would not back.
 */
export function headline(a: CityAnalysis, lens: Lens): Headline | null {
  const shown = lens.metrics.map((lm) => ({ lm, r: a.results[lm.metric] })).filter((x) => x.r?.shown && x.r.trend)
  const real = shown.filter((x) => x.r.trend!.significant).length
  const fits = shown.filter(({ r }) => {
    const t = r.trend!
    return t.significant && hasGap(r.def, r.diff) && (r.diff as number) > 0 === t.slope > 0
  })
  if (!fits.length) return null
  // rain at one point is the least certain data on the page, so it only leads when nothing else qualifies
  const solid = fits.filter((x) => !x.r.def.lessCertain)
  const best = (solid.length ? solid : fits).reduce((p, c) => (Math.abs(c.r.trend!.z) > Math.abs(p.r.trend!.z) ? c : p))
  return {
    lm: best.lm,
    r: best.r,
    line: noteLine(best.r.def, best.lm, best.r.diff),
    worse: (best.r.diff as number) > 0 === best.lm.moreIsBad,
    real,
    total: shown.length,
  }
}
