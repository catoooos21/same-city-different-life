import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { YEARS } from '../config/metrics'
import { LAND_MEASURES, LAND_PARAMS, groundStory, landAnnual, landResult, landUrl, parseDemoLand, parseLand, type LandDaily, type LandMeasure } from '../land'
import { calendar } from '../metrics'
import { DEMO_CITIES, daysBetween } from '../power'

const file = (id: string) => resolve(__dirname, `../../public/demo/${id}.land.json`)
const demoJson = (id: string) => JSON.parse(readFileSync(file(id), 'utf-8'))
const demo = (id: string): LandDaily => parseDemoLand(demoJson(id), 0, 0)
const measure = (id: string): LandMeasure => LAND_MEASURES.find((m) => m.def.id === id)!
const at = (s: { values: (number | null)[] }, year: number) => s.values[year - YEARS.first]
const THEN = { first: 1981, last: 1990 }
const NOW = { first: 2016, last: 2025 }

describe('land: reading the data', () => {
  it('asks NASA POWER for the three land parameters over all the years', () => {
    const u = new URL(landUrl(29.3759, 47.9774))
    expect(u.searchParams.get('parameters')).toBe('TS,GWETTOP,EVLAND')
    expect(u.searchParams.get('start')).toBe(`${YEARS.first}0101`)
    expect(u.searchParams.get('end')).toBe(`${YEARS.last}1231`)
    // local solar days, like the weather on the rest of the page
    expect(u.searchParams.get('time-standard')).toBeNull()
  })

  it('places POWER values on the app day index and turns fill values into gaps', () => {
    const json = {
      header: { fill_value: -999 },
      properties: {
        parameter: {
          TS: { '19810101': 12.5, '19810102': -999 },
          GWETTOP: { '19810101': 0.24, '19810102': 0.25 },
          EVLAND: { '19810101': 0.3, '19810102': 0.1 },
        },
      },
    }
    const d = parseLand(json, 51.5, -0.1)
    expect(d.n).toBe(daysBetween(YEARS.first, YEARS.last))
    expect(d.values.TS[0]).toBeCloseTo(12.5, 2)
    expect(Number.isNaN(d.values.TS[1])).toBe(true)
    expect(d.values.GWETTOP[1]).toBeCloseTo(0.25, 2)
    expect(d.values.EVLAND[1]).toBeCloseTo(0.1, 2)
    expect(Number.isNaN(d.values.EVLAND[2])).toBe(true)
  })

  it('refuses an answer that is missing a parameter or has no data', () => {
    const noEvaporation = { properties: { parameter: { TS: { '19810101': 1 }, GWETTOP: { '19810101': 1 } } } }
    expect(() => parseLand(noEvaporation, 0, 0)).toThrow(/EVLAND/)
    const empty = { header: { fill_value: -999 }, properties: { parameter: Object.fromEntries(LAND_PARAMS.map((p) => [p, { '19810101': -999 }])) } }
    expect(() => parseLand(empty, 0, 0)).toThrow(/no land data/)
  })

  it('has a bundled copy for every demo city, covering every day', () => {
    for (const c of DEMO_CITIES) {
      expect(existsSync(file(c.id)), c.id).toBe(true)
      const j = demoJson(c.id)
      expect(j.first).toBe(YEARS.first)
      for (const p of LAND_PARAMS) expect(j.values[p], `${c.id} ${p}`).toHaveLength(daysBetween(YEARS.first, YEARS.last))
      expect(j.lat).toBeCloseTo(c.lat, 3)
    }
  })
})

describe('land: yearly numbers', () => {
  const kuwait = demo('kuwait-city')
  const london = demo('london')

  it('computes each yearly number straight from the daily values', () => {
    const cal = calendar(london.n)
    for (const year of [1981, 2000, 2024]) {
      const i0 = cal.yearStart.get(year)!
      const len = cal.yearLength.get(year)!
      const days = (p: 'TS' | 'GWETTOP' | 'EVLAND') => Array.from(london.values[p].subarray(i0, i0 + len))
      const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length
      expect(at(landAnnual(measure('ground_temp'), london), year)!).toBeCloseTo(mean(days('TS')), 3)
      // soil wetness is served 0–1 and shown in %
      expect(at(landAnnual(measure('soil_wetness'), london), year)!).toBeCloseTo(mean(days('GWETTOP')) * 100, 2)
      expect(at(landAnnual(measure('land_evaporation'), london), year)!).toBeCloseTo(days('EVLAND').reduce((s, v) => s + v, 0), 1)
    }
  })

  it('drops a year with too many missing days and scales a total over a small gap', () => {
    const d: LandDaily = { ...kuwait, values: { ...kuwait.values, EVLAND: kuwait.values.EVLAND.slice(), TS: kuwait.values.TS.slice() } }
    const cal = calendar(d.n)
    const i0 = cal.yearStart.get(1990)!
    // 60 of 365 days missing: more than 10 %, so 1990 is not counted
    d.values.TS.fill(NaN, i0, i0 + 60)
    expect(at(landAnnual(measure('ground_temp'), d), 1990)).toBeNull()
    expect(at(landAnnual(measure('ground_temp'), d), 1991)).not.toBeNull()
    // 10 days missing: the total is scaled to the full year instead of looking like a dry year
    const whole = at(landAnnual(measure('land_evaporation'), kuwait), 1990)!
    const lost = Array.from(d.values.EVLAND.subarray(i0, i0 + 10)).reduce((s, v) => s + v, 0)
    d.values.EVLAND.fill(NaN, i0, i0 + 10)
    expect(at(landAnnual(measure('land_evaporation'), d), 1990)!).toBeCloseTo(((whole - lost) * 365) / 355, 3)
  })

  it('runs the trend test on all 45 years and compares the same two periods as the page', () => {
    const r = landResult(measure('ground_temp'), kuwait, THEN, NOW)
    expect(r.trend!.n).toBe(45)
    expect(r.then.validYears).toBe(10)
    expect(r.now.validYears).toBe(10)
    expect(r.diff!).toBeCloseTo(r.now.mean! - r.then.mean!, 6)
    expect(r.slopePerDecade!).toBeCloseTo(r.trend!.slope * 10, 9)
    // the desert ground is hot and has warmed
    expect(r.then.mean!).toBeGreaterThan(20)
    expect(r.trend!.significant).toBe(true)
    expect(r.trend!.direction).toBe('up')
  })

  it('shows three measures and no snow: the model snow depth is not a count of snowy days', () => {
    for (const city of [kuwait, london]) {
      const rows = groundStory(city, THEN, NOW)
      expect(rows.map((r) => r.result.def.id)).toEqual(['ground_temp', 'soil_wetness', 'land_evaporation'])
      for (const row of rows) expect(row.result.trend).not.toBeNull()
    }
    expect(LAND_PARAMS).not.toContain('SNODP')
  })

  it('gives sensible numbers in every bundled city', () => {
    for (const c of DEMO_CITIES) {
      const rows = groundStory(demo(c.id), THEN, NOW)
      const by = Object.fromEntries(rows.map((r) => [r.result.def.id, r.result]))
      expect(by.ground_temp.then.mean!, c.id).toBeGreaterThan(5)
      expect(by.ground_temp.then.mean!, c.id).toBeLessThan(35)
      expect(by.soil_wetness.then.mean!, c.id).toBeGreaterThan(0)
      expect(by.soil_wetness.then.mean!, c.id).toBeLessThan(100)
      expect(by.land_evaporation.then.mean!, c.id).toBeGreaterThan(0)
    }
  })
})
