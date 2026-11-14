import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { YEARS } from '../config/metrics'
import { callOf, matchCalls } from '../casefile'
import { calendar } from '../metrics'
import { daysBetween } from '../power'
import { GPM_YEARS, RAIN_IDS, agrees, parseDemoRain, parseRain, rainResult, rainUrl, secondOpinion, type RainDaily } from '../rain'

const demoJson = (id: string) => JSON.parse(readFileSync(resolve(__dirname, `../../public/demo/${id}.rain.json`), 'utf-8'))
const demo = (id: string): RainDaily => parseDemoRain(demoJson(id), 0, 0)
const at = (r: { annual: { values: (number | null)[] } }, year: number) => r.annual.values[year - YEARS.first]

describe('satellite rain: reading the data', () => {
  it('asks NASA POWER for both sources in UTC, from 1998', () => {
    const u = new URL(rainUrl(29.3759, 47.9774))
    expect(u.searchParams.get('parameters')).toBe('IMERG_PRECTOT,PRECTOTCORR')
    expect(u.searchParams.get('time-standard')).toBe('utc')
    expect(u.searchParams.get('start')).toBe('19980101')
    expect(u.searchParams.get('end')).toBe(`${YEARS.last}1231`)
  })

  it('places POWER values on the app day index and turns fill values into gaps', () => {
    const json = {
      header: { fill_value: -999 },
      properties: {
        parameter: {
          IMERG_PRECTOT: { '19980101': 18.31, '19980102': -999, '19980103': 0 },
          PRECTOTCORR: { '19980101': 2.5, '19980102': 1, '19980103': -999 },
        },
      },
    }
    const r = parseRain(json, 51.5, -0.1)
    const i0 = daysBetween(YEARS.first, 1997) // index of 1998-01-01
    expect(r.n).toBe(daysBetween(YEARS.first, YEARS.last))
    expect(r.satellite[i0]).toBeCloseTo(18.31, 2)
    expect(Number.isNaN(r.satellite[i0 + 1])).toBe(true)
    expect(r.satellite[i0 + 2]).toBe(0)
    expect(r.model[i0]).toBeCloseTo(2.5, 2)
    expect(Number.isNaN(r.model[i0 + 2])).toBe(true)
    // nothing before the satellite era
    expect(Number.isNaN(r.satellite[i0 - 1])).toBe(true)
  })

  it('refuses an answer with no satellite rain at all', () => {
    const empty = { header: { fill_value: -999 }, properties: { parameter: { IMERG_PRECTOT: { '19980101': -999 }, PRECTOTCORR: { '19980101': 1 } } } }
    expect(() => parseRain(empty, 0, 0)).toThrow(/no satellite rain/)
  })

  it('reads the bundled demo copy onto the same index', () => {
    const j = demoJson('kuwait-city')
    const r = parseDemoRain(j, 29.3759, 47.9774)
    const i0 = daysBetween(YEARS.first, 1997)
    expect(j.first).toBe(1998)
    expect(j.timeStandard).toBe('UTC')
    expect(j.values.IMERG_PRECTOT).toHaveLength(daysBetween(1998, YEARS.last))
    expect(r.satellite[i0]).toBeCloseTo(j.values.IMERG_PRECTOT[0], 2)
    expect(r.model[r.n - 1]).toBeCloseTo(j.values.PRECTOTCORR.at(-1), 2)
    expect(Number.isNaN(r.model[i0 - 1])).toBe(true)
  })
})

describe('satellite rain: the comparison', () => {
  const kuwait = demo('kuwait-city')

  it('gives yearly values for the satellite years only', () => {
    const r = rainResult('rainy_days', kuwait.satellite, kuwait)
    expect(at(r, 1997)).toBeNull()
    expect(at(r, 1981)).toBeNull()
    expect(r.annual.values.filter((v) => v !== null)).toHaveLength(GPM_YEARS.last - GPM_YEARS.first + 1)
    expect(r.trend!.n).toBe(28)
  })

  it('counts rainy days and yearly rain straight from the daily values', () => {
    const cal = calendar(kuwait.n)
    for (const year of [1998, 2010, 2018]) {
      const i0 = cal.yearStart.get(year)!
      const len = cal.yearLength.get(year)!
      for (const [name, arr] of [
        ['satellite', kuwait.satellite],
        ['model', kuwait.model],
      ] as const) {
        const days = Array.from(arr.subarray(i0, i0 + len))
        expect(at(rainResult('rainy_days', arr, kuwait), year), `${name} ${year}`).toBe(days.filter((v) => v >= 1).length)
        expect(at(rainResult('rain_total', arr, kuwait), year)!).toBeCloseTo(days.reduce((a, b) => a + b, 0), 1)
        expect(at(rainResult('biggest_downpour', arr, kuwait), year)!).toBeCloseTo(Math.max(...days), 2)
      }
    }
    // the numbers seen when the service was first checked: 1998 had 22 rainy days by satellite, 13 by the model
    expect(at(rainResult('rainy_days', kuwait.satellite, kuwait), 1998)).toBe(22)
    expect(at(rainResult('rainy_days', kuwait.model, kuwait), 1998)).toBe(13)
  })

  it('compares every rain measure and says whether the two sources agree', () => {
    const rows = secondOpinion(kuwait)
    expect(rows.map((r) => r.id)).toEqual(RAIN_IDS)
    for (const row of rows) {
      expect(row.match).toBe(matchCalls(callOf(row.satellite), callOf(row.model)))
      expect(row.satellite.then.mean).not.toBeNull()
      expect(row.model.then.mean).not.toBeNull()
    }
    // in the desert the satellite sees clearly more rainy days than the model
    const rainy = rows.find((r) => r.id === 'rainy_days')!
    expect(rainy.satellite.then.mean!).toBeGreaterThan(rainy.model.then.mean! * 1.5)
  })

  it('agrees with itself: the same series twice never disagrees', () => {
    const twin: RainDaily = { ...kuwait, model: kuwait.satellite }
    for (const row of secondOpinion(twin)) expect(agrees(row.match)).toBe(true)
    expect(agrees('opposite')).toBe(false)
    expect(agrees('onlyA')).toBe(false)
    expect(agrees('missing')).toBe(false)
  })

  it('works for every bundled city', () => {
    for (const id of ['london', 'sydney', 'delhi']) {
      const rows = secondOpinion(demo(id))
      expect(rows).toHaveLength(RAIN_IDS.length)
      for (const row of rows) expect(row.satellite.trend).not.toBeNull()
    }
  })
})
