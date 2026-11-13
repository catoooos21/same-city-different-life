import { describe, expect, it } from 'vitest'
import fixtures from './fixtures.json'
import { annualTrend, hamedRao, mannKendall, normCdf, normPpf, percentile, rankdata, sensSlope, theilslopes } from '../stats'

const TOL = 1e-6

describe('normal distribution helpers', () => {
  it('cdf and ppf agree with known values', () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 10)
    expect(normCdf(1.959963984540054)).toBeCloseTo(0.975, 7)
    expect(normPpf(0.975)).toBeCloseTo(1.959963984540054, 7)
    expect(normPpf(0.025)).toBeCloseTo(-1.959963984540054, 7)
    expect(normPpf(0.5)).toBeCloseTo(0, 10)
  })
})

describe('rankdata', () => {
  it('gives average ranks for ties', () => {
    expect(rankdata([10, 20, 20, 30])).toEqual([1, 2.5, 2.5, 4])
    expect(rankdata([3, 1, 2])).toEqual([3, 1, 2])
  })
})

describe('percentile', () => {
  it('matches numpy linear interpolation', () => {
    const { values, p90, p50 } = fixtures.percentiles
    expect(percentile(values, 90)).toBeCloseTo(p90, 9)
    expect(percentile(values, 50)).toBeCloseTo(p50, 9)
  })
})

describe('statistics match the Python reference (pymannkendall + scipy)', () => {
  for (const c of fixtures.cases) {
    it(`${c.name}: Hamed-Rao MK`, () => {
      const r = hamedRao(c.values)
      expect(r.s).toBe(c.hamed_rao.s)
      expect(Math.abs(r.varS - c.hamed_rao.var_s) / c.hamed_rao.var_s).toBeLessThan(TOL)
      expect(r.z).toBeCloseTo(c.hamed_rao.z, 6)
      expect(r.tau).toBeCloseTo(c.hamed_rao.tau, 9)
      expect(r.p).toBeCloseTo(c.hamed_rao.p, 6)
      expect(r.h).toBe(c.hamed_rao.h)
    })
    it(`${c.name}: original MK`, () => {
      const r = mannKendall(c.values)
      expect(r.p).toBeCloseTo(c.original.p, 6)
      expect(r.z).toBeCloseTo(c.original.z, 6)
    })
    it(`${c.name}: Sen's slope (evenly spaced)`, () => {
      const r = sensSlope(c.values)
      expect(r.slope).toBeCloseTo(c.hamed_rao.slope, 9)
      expect(r.intercept).toBeCloseTo(c.hamed_rao.intercept, 9)
    })
    it(`${c.name}: theilslopes with CI`, () => {
      const r = theilslopes(c.values, c.years, 0.95)
      expect(r.slope).toBeCloseTo(c.theilslopes.slope, 9)
      expect(r.intercept).toBeCloseTo(c.theilslopes.intercept, 9)
      expect(r.low).toBeCloseTo(c.theilslopes.low, 9)
      expect(r.high).toBeCloseTo(c.theilslopes.high, 9)
    })
  }
})

describe('annualTrend', () => {
  it('drops nulls, returns per-year slope and label', () => {
    const c = fixtures.cases.find((x) => x.name === 'linear_trend_noise')!
    const vals: (number | null)[] = c.values.slice()
    vals[5] = null
    const t = annualTrend(c.years, vals)!
    expect(t.n).toBe(c.values.length - 1)
    expect(t.direction).toBe('up')
    expect(t.significant).toBe(true)
    expect(t.ci[0]).toBeLessThanOrEqual(t.slope)
    expect(t.ci[1]).toBeGreaterThanOrEqual(t.slope)
  })
  it('returns null for fewer than 10 valid years', () => {
    expect(annualTrend([1, 2, 3, 4, 5], [1, 2, 3, 4, 5])).toBeNull()
  })
  it('white noise is "cannot tell"', () => {
    const c = fixtures.cases.find((x) => x.name === 'white_noise')!
    const t = annualTrend(c.years, c.values)!
    expect(t.significant).toBe(false)
    expect(t.direction).toBe('none')
  })
})
