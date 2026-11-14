import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LENSES, LENS_BY_ID } from '../config/lenses'
import { PARAMS, YEARS, type Param } from '../config/metrics'
import { headline } from '../headline'
import { analyse, childhood } from '../metrics'
import { hasGap } from '../notewords'
import { DEMO_CITIES, daysBetween, type DailySeries } from '../power'

function demo(id: string): DailySeries {
  const j = JSON.parse(readFileSync(resolve(__dirname, `../../public/demo/${id}.json`), 'utf-8'))
  const n = daysBetween(YEARS.first, YEARS.last)
  const values = {} as Record<Param, Float32Array>
  for (const p of PARAMS) values[p] = Float32Array.from({ length: n }, (_, i) => (j.values[p][i] === null || j.values[p][i] === undefined ? NaN : j.values[p][i]))
  return { lat: 0, lon: 0, n, values, header: j.header, fetchedAt: j.fetchedAt }
}

describe('the headline finding', () => {
  const kuwait = analyse(demo('kuwait-city'), childhood(1981), childhood(2015))

  it('leads with a real change that the two lives also show', () => {
    const h = headline(kuwait, LENS_BY_ID.kid)!
    expect(h).not.toBeNull()
    expect(h.r.trend!.significant).toBe(true)
    expect(hasGap(h.r.def, h.r.diff)).toBe(true)
    expect(h.r.diff! > 0).toBe(h.r.trend!.slope > 0)
    expect(h.line).toMatch(/every year\.$/)
    // more hot days or warm nights is worse for a kid
    expect(h.worse).toBe(true)
    expect(h.total).toBe(LENS_BY_ID.kid.metrics.filter((m) => kuwait.results[m.metric].shown).length)
    expect(h.real).toBeLessThanOrEqual(h.total)
  })

  it('picks the strongest trend test among the measures that qualify', () => {
    const h = headline(kuwait, LENS_BY_ID.kid)!
    for (const lm of LENS_BY_ID.kid.metrics) {
      const r = kuwait.results[lm.metric]
      if (!r.shown || !r.trend?.significant || r.def.lessCertain || !hasGap(r.def, r.diff) || r.diff! > 0 !== r.trend.slope > 0) continue
      expect(Math.abs(h.r.trend!.z)).toBeGreaterThanOrEqual(Math.abs(r.trend.z))
    }
  })

  it('lets a rain-only measure lead only when nothing more certain qualifies', () => {
    for (const c of DEMO_CITIES) {
      const a = analyse(demo(c.id), childhood(1981), childhood(2015))
      for (const lens of LENSES) {
        const h = headline(a, lens)
        if (!h?.r.def.lessCertain) continue
        const moreCertain = lens.metrics
          .map((m) => a.results[m.metric])
          .filter((r) => r.shown && r.trend?.significant && !r.def.lessCertain && hasGap(r.def, r.diff) && r.diff! > 0 === r.trend.slope > 0)
        expect(moreCertain, `${c.id} ${lens.id}`).toHaveLength(0)
      }
    }
  })

  it('says nothing when the two lives are the same years', () => {
    const same = analyse(demo('kuwait-city'), childhood(1990), childhood(1990))
    expect(headline(same, LENS_BY_ID.kid)).toBeNull()
  })

  it('never leads with a change the stamp would not back, in any city or lens', () => {
    for (const c of DEMO_CITIES) {
      const a = analyse(demo(c.id), childhood(1981), childhood(2015))
      for (const lens of LENSES) {
        const h = headline(a, lens)
        if (h) expect(h.r.trend!.significant, `${c.id} ${lens.id}`).toBe(true)
      }
    }
  })
})
