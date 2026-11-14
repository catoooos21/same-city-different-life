import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PARAMS, YEARS, type Param } from '../config/metrics'
import { COOLING, DEGREE_DAY_BASE_C, HEATING, STUDIES, costResult, costRows, percentChange } from '../cost'
import { analyse, calendar, childhood } from '../metrics'
import { daysBetween, type DailySeries } from '../power'

function demo(id: string): DailySeries {
  const j = JSON.parse(readFileSync(resolve(__dirname, `../../public/demo/${id}.json`), 'utf-8'))
  const n = daysBetween(YEARS.first, YEARS.last)
  const values = {} as Record<Param, Float32Array>
  for (const p of PARAMS) values[p] = Float32Array.from({ length: n }, (_, i) => (j.values[p][i] === null || j.values[p][i] === undefined ? NaN : j.values[p][i]))
  return { lat: 0, lon: 0, n, values, header: j.header, fetchedAt: j.fetchedAt }
}
const at = (r: { annual: { values: (number | null)[] } }, year: number) => r.annual.values[year - YEARS.first]

describe('what it costs', () => {
  const kuwaitD = demo('kuwait-city')
  const kuwait = analyse(kuwaitD, childhood(1981), childhood(2015))
  const londonD = demo('london')
  const london = analyse(londonD, childhood(1981), childhood(2015))

  it('adds up degree days straight from the daily mean temperature', () => {
    const cal = calendar(londonD.n)
    for (const year of [1985, 2003, 2022]) {
      const i0 = cal.yearStart.get(year)!
      const days = Array.from(londonD.values.T2M.subarray(i0, i0 + cal.yearLength.get(year)!))
      const cdd = days.reduce((s, t) => s + Math.max(0, t - DEGREE_DAY_BASE_C), 0)
      const hdd = days.reduce((s, t) => s + Math.max(0, DEGREE_DAY_BASE_C - t), 0)
      expect(at(costResult(COOLING, londonD, london), year)!).toBeCloseTo(cdd, 1)
      expect(at(costResult(HEATING, londonD, london), year)!).toBeCloseTo(hdd, 1)
    }
  })

  it('uses the page trend test and the page periods', () => {
    const r = costResult(COOLING, kuwaitD, kuwait)
    expect(r.trend!.n).toBe(45)
    expect(r.then.validYears).toBe(10)
    expect(r.diff!).toBeCloseTo(r.now.mean! - r.then.mean!, 6)
    // a desert city: a lot of cooling need, and more of it now
    expect(r.then.mean!).toBeGreaterThan(2000)
    expect(r.trend!.significant).toBe(true)
    expect(r.trend!.direction).toBe('up')
    expect(percentChange(r)!).toBeGreaterThan(0)
  })

  it('shows heating only where it matters, and hot-day counts only where they happen', () => {
    const k = costRows(kuwaitD, kuwait).map((r) => r.result.def.id)
    const l = costRows(londonD, london).map((r) => r.result.def.id)
    expect(k).toContain('cooling_need')
    expect(k).toContain('very_hot_days')
    expect(l).toContain('heating_need')
    expect(l).not.toContain('very_hot_days')
    // London: warmer winters need less heating, and the section says so instead of only showing bad news
    const heating = costRows(londonD, london).find((r) => r.result.def.id === 'heating_need')!.result
    expect(heating.diff!).toBeLessThan(0)
  })

  it('gives no percentage when the starting value is about zero', () => {
    const r = costResult(COOLING, kuwaitD, kuwait)
    expect(percentChange({ ...r, then: { ...r.then, mean: 0.2 } })).toBeNull()
    expect(percentChange({ ...r, then: { ...r.then, mean: null } })).toBeNull()
    expect(percentChange({ ...r, then: { ...r.then, mean: 200 }, now: { ...r.now, mean: 250 } })).toBeCloseTo(25, 6)
  })

  it('quotes every money figure with a source link', () => {
    expect(STUDIES.length).toBeGreaterThan(0)
    for (const s of STUDIES) {
      expect(s.url).toMatch(/^https:\/\//)
      expect(s.source.length).toBeGreaterThan(10)
      expect(s.figure).toMatch(/US\$/)
    }
  })
})
