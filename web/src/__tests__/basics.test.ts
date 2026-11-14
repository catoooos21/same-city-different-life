import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { METRIC_BY_ID, PARAMS, YEARS, type Param } from '../config/metrics'
import { analyse, calendar, childhood } from '../metrics'
import { daysBetween, type DailySeries } from '../power'
import { basicMetrics, caseMetrics } from '../casefile'
import { whatIf } from '../future'
import { axisFromZero, clampValue, rateDigits, unitLong, unitShort } from '../units'

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

/** Straight from the daily values, with no help from the app's own yearly code. */
function yearValues(d: DailySeries, p: Param, year: number): number[] {
  const cal = calendar(d.n)
  const i0 = cal.yearStart.get(year)!
  const len = cal.yearLength.get(year)!
  return Array.from(d.values[p].subarray(i0, i0 + len)).filter((v) => !Number.isNaN(v))
}
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const at = (a: ReturnType<typeof analyse>, id: string, year: number) => a.results[id].annual.values[year - YEARS.first] as number

describe('the basics: plain temperature and rain', () => {
  const d = loadDemo('london')
  const a = analyse(d, childhood(1981), childhood(2015))

  it('yearly averages match the daily values', () => {
    for (const year of [1981, 2000, 2024]) {
      const t = yearValues(d, 'T2M', year)
      expect(at(a, 'mean_temp', year)).toBeCloseTo(sum(t) / t.length, 3)
      const hi = yearValues(d, 'T2M_MAX', year)
      expect(at(a, 'mean_tmax', year)).toBeCloseTo(sum(hi) / hi.length, 3)
      const lo = yearValues(d, 'T2M_MIN', year)
      expect(at(a, 'mean_tmin', year)).toBeCloseTo(sum(lo) / lo.length, 3)
    }
  })

  it('daytime high is above the average, which is above the night-time low, every year', () => {
    for (let y = YEARS.first; y <= YEARS.last; y++) {
      expect(at(a, 'mean_tmax', y)).toBeGreaterThan(at(a, 'mean_temp', y))
      expect(at(a, 'mean_temp', y)).toBeGreaterThan(at(a, 'mean_tmin', y))
    }
  })

  it('yearly rain is the sum of the daily rain, and never less than the wettest day', () => {
    for (const year of [1981, 2000, 2024]) {
      const r = yearValues(d, 'PRECTOTCORR', year)
      const full = r.length === (calendar(d.n).yearLength.get(year) as number)
      if (full) expect(at(a, 'rain_total', year)).toBeCloseTo(sum(r), 1)
      expect(at(a, 'rain_total', year)).toBeGreaterThanOrEqual(at(a, 'biggest_downpour', year))
    }
  })

  it('are listed as basics, in order, and stay out of the counted-days cases', () => {
    expect(basicMetrics(a).map((r) => r.def.id)).toEqual(['mean_temp', 'mean_tmax', 'mean_tmin', 'rain_total'])
    expect(caseMetrics(a).some((r) => r.def.basic)).toBe(false)
    expect(a.results.mean_temp.trend!.significant).toBe(true)
    expect(a.results.mean_temp.slopePerDecade!).toBeGreaterThan(0)
    // rain is flagged as the less certain kind of data
    expect(METRIC_BY_ID.rain_total.lessCertain).toBe(true)
  })

  it('words each unit properly', () => {
    const t = METRIC_BY_ID.mean_temp
    const hot = METRIC_BY_ID.hot_days
    const wet = METRIC_BY_ID.biggest_downpour
    expect(unitShort(t)).toBe('°C')
    expect(unitShort(hot, 1)).toBe('day')
    expect(unitShort(hot, 3)).toBe('days')
    expect(unitLong(hot)).toBe('days a year')
    expect(unitLong(wet)).toBe('mm on the wettest day')
    expect(unitLong(METRIC_BY_ID.rain_total)).toBe('mm in the year')
    expect(rateDigits(t, 0.36)).toBe(2)
    expect(rateDigits(hot, 11)).toBe(0)
    expect(axisFromZero(t)).toBe(false)
    expect(axisFromZero(hot)).toBe(true)
  })

  it('lets temperature go below zero but not days or rain', () => {
    expect(clampValue(METRIC_BY_ID.mean_temp, -8)).toBe(-8)
    expect(clampValue(METRIC_BY_ID.hot_days, -8)).toBe(0)
    expect(clampValue(METRIC_BY_ID.hot_days, 400)).toBe(366)
    expect(clampValue(METRIC_BY_ID.rain_total, -8)).toBe(0)
    // a temperature what-if is a temperature, not a count capped at 366
    const w = whatIf(a.results.mean_temp, 2040)!
    expect(w.value).toBeGreaterThan(at(a, 'mean_temp', 2024) - 3)
    expect(w.value).toBeLessThan(40)
  })
})
