import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PARAMS, YEARS, type Param } from '../config/metrics'
import { ACTIONS } from '../config/actions'
import { analyse } from '../metrics'
import { daysBetween, type DailySeries } from '../power'
import { WORLD_PER_DECADE, countWeather, lifeScore, summarise, weatherOf, type CountryRow, type CountrySummary } from '../countries'

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

const temp = (perDecade: number, significant: boolean) => ({ perDecade, p: significant ? 0.001 : 0.5, significant })
const row = (t: CountrySummary['temp'], metrics: CountrySummary['metrics'] = []): CountrySummary => ({ temp: t, hotDays: { then: null, now: null }, metrics })

describe('country weather category', () => {
  it('uses the trend test and the world rate', () => {
    expect(WORLD_PER_DECADE).toBeGreaterThan(0.1)
    expect(WORLD_PER_DECADE).toBeLessThan(0.3)
    expect(weatherOf(row(temp(0.5, true)), 0.2)).toBe('fast')
    expect(weatherOf(row(temp(0.25, true)), 0.2)).toBe('heating')
    expect(weatherOf(row(temp(0.5, false)), 0.2)).toBe('none')
    expect(weatherOf(row(temp(-0.2, true)), 0.2)).toBe('cooling')
    expect(weatherOf(row(null), 0.2)).toBe('unknown')
  })

  it('counts worse and better only for real changes, and leaves rain neutral', () => {
    const s = row(temp(0.3, true), [
      { id: 'hot_days', call: 'up', perDecade: 8 },
      { id: 'hot_nights', call: 'none', perDecade: 1 },
      { id: 'perfect_days', call: 'up', perDecade: 3 },
      { id: 'training_days', call: 'down', perDecade: -2 },
      { id: 'rainy_days', call: 'down', perDecade: -4 },
    ])
    expect(lifeScore(s)).toEqual({ worse: 2, better: 1 })
  })

  it('summarises Kuwait City as heating, with hot days going up', () => {
    const s = summarise(analyse(loadDemo('kuwait-city'), { first: 1981, last: 1990 }, { first: 2016, last: 2025 }))
    expect(s.temp?.significant).toBe(true)
    expect(['fast', 'heating']).toContain(weatherOf(s))
    expect(s.metrics.find((m) => m.id === 'hot_days')?.call).toBe('up')
    expect(s.hotDays.now!).toBeGreaterThan(s.hotDays.then!)
    expect(lifeScore(s).worse).toBeGreaterThan(0)
  })
})

describe('countries.json', () => {
  const path = resolve(__dirname, '../../public/countries.json')
  const rows: CountryRow[] = existsSync(path) ? JSON.parse(readFileSync(path, 'utf-8')).countries : []

  it.skipIf(rows.length === 0)('has a row for every country with an action note', () => {
    const names = new Set(rows.map((r) => r.country))
    for (const c of Object.keys(ACTIONS)) expect(names.has(c), c).toBe(true)
  })

  it.skipIf(rows.length === 0)('every row can be categorised', () => {
    const counts = countWeather(rows)
    expect(counts.fast + counts.heating + counts.none + counts.cooling + counts.unknown).toBe(rows.length)
    expect(rows.length).toBeGreaterThan(100)
  })
})
