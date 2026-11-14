import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PARAMS, YEARS, type Param } from '../config/metrics'
import { FUTURE_BIRTH_YEAR } from '../config/context'
import { analyse, childhood } from '../metrics'
import { daysBetween, type DailySeries } from '../power'
import { projectFuture } from '../components/Scrapbook'
import { SLOWER_PACE, whatIf } from '../future'

function loadDemo(id: string): DailySeries {
  const j = JSON.parse(readFileSync(resolve(__dirname, `../../public/demo/${id}.json`), 'utf-8'))
  const n = daysBetween(YEARS.first, YEARS.last)
  const values = {} as Record<Param, Float32Array>
  for (const p of PARAMS) {
    const arr = new Float32Array(n).fill(NaN)
    const src: (number | null)[] = j.values[p]
    for (let i = 0; i < n; i++) if (src[i] !== null) arr[i] = src[i] as number
    values[p] = arr
  }
  return { lat: j.lat, lon: j.lon, n, values, header: j.header, fetchedAt: j.fetchedAt }
}

describe('two futures', () => {
  const a = analyse(loadDemo('kuwait-city'), childhood(1981), childhood(2015))
  const hot = a.results.hot_days

  it('at the same pace it matches the "Born 2040" line on the sticky note', () => {
    expect(whatIf(hot, FUTURE_BIRTH_YEAR, 1)!.value).toBeCloseTo(projectFuture(hot)!, 6)
  })

  it('the slower future sits between today and the same-pace future', () => {
    const t = hot.trend!
    const today = t.intercept + t.slope * YEARS.last
    const same = whatIf(hot, 2040, 1)!.value
    const slower = whatIf(hot, 2040, SLOWER_PACE)!.value
    expect(t.slope).toBeGreaterThan(0)
    expect(slower).toBeGreaterThan(today)
    expect(slower).toBeLessThan(same)
    expect(slower - today).toBeCloseTo((same - today) * SLOWER_PACE, 6)
  })

  it('gives a range that contains the value and grows with distance', () => {
    const near = whatIf(hot, 2030)!
    const far = whatIf(hot, 2050)!
    for (const w of [near, far]) {
      expect(w.lo).toBeLessThanOrEqual(w.value)
      expect(w.hi).toBeGreaterThanOrEqual(w.value)
    }
    expect(far.hi - far.lo).toBeGreaterThan(near.hi - near.lo)
  })

  it('never leaves what a year can hold, and skips metrics with no clear change', () => {
    for (const r of Object.values(a.results)) {
      const w = whatIf(r, 2050)
      if (!r.trend || !r.trend.significant) {
        expect(w).toBeNull()
        continue
      }
      expect(w!.lo).toBeGreaterThanOrEqual(0)
      if (r.def.unit === 'days') expect(w!.hi).toBeLessThanOrEqual(366)
    }
  })
})
