import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import fixtures from './fixtures.json'
import { METRIC_BY_ID, PARAMS, YEARS, type Param } from '../config/metrics'
import { analyse, annualSeries, calendar, childhood, cityContext, isLeap, periodStat } from '../metrics'
import { daysBetween, type DailySeries } from '../power'

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

describe('calendar', () => {
  it('counts 16436 days for 1981-2025 with 11 leap years', () => {
    expect(daysBetween(1981, 2025)).toBe(16436)
    const cal = calendar(16436)
    expect(cal.yearLength.get(1984)).toBe(366)
    expect(cal.yearLength.get(2000)).toBe(366)
    expect(cal.yearLength.get(1981)).toBe(365)
    expect(cal.yearStart.get(2025)! + 365).toBe(16436)
    expect(isLeap(1900)).toBe(false)
    expect(cal.month[cal.yearStart.get(1984)! + 59]).toBe(1) // 29 Feb 1984
    expect(cal.month[cal.yearStart.get(1984)! + 60]).toBe(2) // 1 Mar 1984
  })
  it('childhood is ten calendar years', () => {
    expect(childhood(1981)).toEqual({ first: 1981, last: 1990 })
    expect(childhood(2015)).toEqual({ first: 2015, last: 2024 })
  })
})

describe('Kuwait City hot days match the Python computation', () => {
  const d = loadDemo('kuwait-city')
  const ctx = cityContext(d)
  const ref = fixtures.cases.find((c) => c.name === 'kuwait_hot_days')
  it('baseline p90 of daily max is about 41.6 C', () => {
    expect(ctx.p90max).toBeGreaterThan(41)
    expect(ctx.p90max).toBeLessThan(42.2)
  })
  it.skipIf(!ref)('annual hot-day counts equal the pandas series', () => {
    const s = annualSeries(METRIC_BY_ID.hot_days, d, ctx)
    expect(s.years).toEqual(ref!.years)
    // demo values are rounded to 2 decimals, so allow a 1-day difference on a handful of years
    let off = 0
    for (let i = 0; i < s.values.length; i++) off += Math.abs((s.values[i] as number) - ref!.values[i])
    expect(off).toBeLessThanOrEqual(3)
  })
  it('then vs now means reproduce the probe numbers', () => {
    const a = analyse(d, childhood(1981), childhood(2015), ['hot_days', 'hot_nights', 'rainy_days'])
    expect(a.results.hot_days.then.mean).toBeCloseTo(31.2, 0)
    expect(a.results.hot_days.now.mean).toBeCloseTo(68.6, 0)
    expect(a.results.hot_nights.now.mean).toBeCloseTo(81.9, 0)
    expect(a.results.rainy_days.then.mean).toBeCloseTo(17.6, 0)
    expect(a.results.hot_days.trend!.significant).toBe(true)
    expect(a.results.hot_days.slopePerDecade).toBeCloseTo(10.6, 0)
  })
})

describe('missing-day rule', () => {
  it('drops a year with more than 10% missing days', () => {
    const d = loadDemo('london')
    const cal = calendar(d.n)
    const i0 = cal.yearStart.get(1995)!
    const copy: DailySeries = { ...d, values: { ...d.values, PRECTOTCORR: d.values.PRECTOTCORR.slice() } }
    for (let i = i0; i < i0 + 40; i++) copy.values.PRECTOTCORR[i] = NaN // 40/365 = 11%
    const s = annualSeries(METRIC_BY_ID.rainy_days, copy, cityContext(copy))
    expect(s.values[1995 - 1981]).toBeNull()
    expect(s.values[1994 - 1981]).not.toBeNull()
    const p = periodStat(s, { first: 1991, last: 2000 })
    expect(p.validYears).toBe(9)
    expect(p.totalYears).toBe(10)
  })
})

describe('southern hemisphere and run metrics', () => {
  const d = loadDemo('sydney')
  const ctx = cityContext(d)
  it('frost days are rare in Sydney and the metric is hidden', () => {
    const a = analyse(d, childhood(1981), childhood(2015), ['frost_days', 'very_hot_days', 'heatwave_days', 'longest_dry_spell'])
    expect(a.results.frost_days.shown).toBe(false)
    // Delhi has both very hot days and (rare) frost-free winters: very hot shown, frost hidden
    const delhi = loadDemo('delhi')
    const b = analyse(delhi, childhood(1981), childhood(2015), ['frost_days', 'very_hot_days'])
    expect(b.results.very_hot_days.shown).toBe(true)
    expect(b.results.very_hot_days.baselineMean!).toBeGreaterThan(30)
  })
  it('heatwave days never exceed hot days and dry spells are within a year', () => {
    const hot = annualSeries(METRIC_BY_ID.hot_days, d, ctx)
    const hw = annualSeries(METRIC_BY_ID.heatwave_days, d, ctx)
    const cdd = annualSeries(METRIC_BY_ID.longest_dry_spell, d, ctx)
    for (let i = 0; i < hot.values.length; i++) {
      expect(hw.values[i]!).toBeLessThanOrEqual(hot.values[i]!)
      expect(cdd.values[i]!).toBeLessThanOrEqual(366)
    }
  })
})
