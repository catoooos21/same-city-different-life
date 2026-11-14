import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { METRICS, PARAMS, YEARS, type Param } from '../config/metrics'
import { analyse, childhood } from '../metrics'
import { daysBetween, type DailySeries } from '../power'
import { CASE_GROUPS, callOf, caseMetrics, compareCities, groupCases, matchCalls, rankCases } from '../casefile'
import { parseHash, toHash } from '../state'

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
    expect(cases.some((r) => r.def.basic)).toBe(false)
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

  it('groups cases by what they measure, losing none and repeating none', () => {
    const groups = groupCases(cases)
    expect(groups.map((g) => g.id)).toEqual(['heat', 'rain', 'comfort'])
    const ids = groups.flatMap((g) => g.cases.map((r) => r.def.id))
    expect(ids).toHaveLength(cases.length)
    expect(new Set(ids).size).toBe(cases.length)
    for (const g of groups) expect(g.real).toBe(g.cases.filter((r) => r.trend!.significant).length)
    // every card metric belongs to a named group
    for (const m of METRICS) if (!m.basic) expect(CASE_GROUPS.some((g) => g.metrics.includes(m.id))).toBe(true)
    // the rain group is exactly the less-certain metrics
    expect([...CASE_GROUPS[1].metrics].sort()).toEqual(METRICS.filter((m) => m.lessCertain && !m.basic).map((m) => m.id).sort())
  })
})

describe('two cities side by side', () => {
  it('names how two calls compare', () => {
    expect(matchCalls('up', 'up')).toBe('same')
    expect(matchCalls('up', 'down')).toBe('opposite')
    expect(matchCalls('down', 'none')).toBe('onlyA')
    expect(matchCalls('none', 'up')).toBe('onlyB')
    expect(matchCalls('none', 'none')).toBe('neither')
    expect(matchCalls(null, 'up')).toBe('missing')
  })

  it('compares Kuwait City with London metric by metric', () => {
    const k = analyse(loadDemo('kuwait-city'), childhood(1981), childhood(2015))
    const l = analyse(loadDemo('london'), childhood(1981), childhood(2015))
    const rows = compareCities(k, l)
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]))
    // the basics come first, in plain units, and both cities are warming
    expect(rows.slice(0, 4).map((r) => r.id)).toEqual(['mean_temp', 'mean_tmax', 'mean_tmin', 'rain_total'])
    expect(byId.mean_temp.match).toBe('same')
    // both warm: unusually hot days go up in both
    expect(byId.hot_days.match).toBe('same')
    // frost happens in London but not in Kuwait City; 35 C days the other way round
    expect(byId.frost_days.a).toBeNull()
    expect(byId.frost_days.match).toBe('missing')
    expect(byId.very_hot_days.b).toBeNull()
    for (const r of rows) expect(r.match).toBe(matchCalls(r.a ? callOf(r.a) : null, r.b ? callOf(r.b) : null))
  })

  it('keeps the second city in the link', () => {
    const h = '#name=Kuwait+City&lat=29.3759&lon=47.9774&vsname=London&vscountry=United+Kingdom&vslat=51.5085&vslon=-0.1257'
    const q = parseHash(h)
    expect(q.vs).toEqual({ name: 'London', country: 'United Kingdom', lat: 51.5085, lon: -0.1257 })
    expect(parseHash(toHash(q)).vs).toEqual(q.vs)
    expect(parseHash('#name=Kuwait+City&lat=29.3759&lon=47.9774').vs).toBeNull()
    expect(toHash(parseHash('#name=Kuwait+City&lat=29.3759&lon=47.9774'))).not.toContain('vs')
  })
})
