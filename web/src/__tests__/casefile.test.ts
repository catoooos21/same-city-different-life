import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PARAMS, YEARS, type Param } from '../config/metrics'
import { analyse, childhood } from '../metrics'
import { daysBetween, type DailySeries } from '../power'
import { callOf, caseMetrics, rankCases } from '../casefile'

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

describe('case file', () => {
  const a = analyse(loadDemo('kuwait-city'), childhood(1981), childhood(2015))
  const cases = caseMetrics(a)

  it('lists only card metrics that happen here and have a trend test', () => {
    expect(cases.length).toBeGreaterThan(5)
    expect(cases.some((r) => r.def.id === 'mean_temp')).toBe(false)
    expect(cases.every((r) => r.shown && r.trend !== null)).toBe(true)
    // Kuwait City has no frost in the baseline, so it is not a case there
    expect(cases.some((r) => r.def.id === 'frost_days')).toBe(false)
  })

  it('calls up/down only for significant trends', () => {
    for (const r of cases) {
      const call = callOf(r)
      if (r.trend!.significant) expect(call).toBe(r.trend!.slope < 0 ? 'down' : 'up')
      else expect(call).toBe('none')
    }
    expect(callOf(a.results.hot_days)).toBe('up')
  })

  it('ranks real changes first, strongest evidence first', () => {
    const ranked = rankCases(cases)
    expect(ranked).toHaveLength(cases.length)
    const firstNone = ranked.findIndex((r) => !r.trend!.significant)
    if (firstNone >= 0) expect(ranked.slice(firstNone).every((r) => !r.trend!.significant)).toBe(true)
    const real = ranked.filter((r) => r.trend!.significant)
    for (let i = 1; i < real.length; i++) expect(Math.abs(real[i - 1].trend!.z)).toBeGreaterThanOrEqual(Math.abs(real[i].trend!.z))
  })
})
