import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ACTIONS } from '../config/actions'
import { changeWords, co2Trend, countryVerdict, verdictOf, verdictSentence, type EmissionsFile } from '../emissions'

const years = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]

describe('CO2 trend over ten years', () => {
  it('calls a steady fall, a steady rise and a flat line', () => {
    expect(co2Trend(years, [100, 97, 95, 92, 88, 86, 83, 80, 78, 75])?.call).toBe('falling')
    expect(co2Trend(years, [100, 103, 105, 108, 112, 114, 117, 120, 122, 125])?.call).toBe('rising')
    expect(co2Trend(years, [100, 101, 99, 100, 102, 98, 100, 101, 99, 100])?.call).toBe('levelled')
  })

  it('does not call a noisy climb "levelled" just because the test is unsure', () => {
    // up about 18 % along the trend line, but one bad dip keeps it from being significant
    const t = co2Trend(years, [98, 96, 99, 87, 73, 68, 105, 107, 111, 113])!
    expect(t.changePct).toBeGreaterThan(5)
    expect(t.call).toBe('rising')
  })

  it('uses only the last ten years and needs ten of them', () => {
    const long = [2010, 2011, 2012, 2013, 2014, 2015, ...years]
    const t = co2Trend(long, [10, 20, 30, 40, 50, 60, 100, 97, 95, 92, 88, 86, 83, 80, 78, 75])!
    expect(t.from).toBe(2016)
    expect(t.to).toBe(2025)
    expect(t.call).toBe('falling')
    expect(co2Trend(years.slice(0, 5), [1, 2, 3, 4, 5])).toBeNull()
  })
})

describe('the stamp', () => {
  const falling = co2Trend(years, [100, 97, 95, 92, 88, 86, 83, 80, 78, 75])!
  const rising = co2Trend(years, [100, 103, 105, 108, 112, 114, 117, 120, 122, 125])!
  const flat = co2Trend(years, [100, 101, 99, 100, 102, 98, 100, 101, 99, 100])!

  it('puts the CO2 first: falling is improving whatever the pledges', () => {
    expect(verdictOf(falling).standing).toBe('improving')
    expect(verdictOf(falling, 'none').standing).toBe('improving')
  })
  it('counts new rules as starting only when the CO2 is not falling', () => {
    expect(verdictOf(rising, 'recent')).toMatchObject({ standing: 'starting', newRulesOnly: true })
    expect(verdictOf(rising, 'none').standing).toBe('worse')
    expect(verdictOf(rising, 'long').standing).toBe('worse')
    expect(verdictOf(rising).standing).toBe('worse')
    expect(verdictOf(flat)).toMatchObject({ standing: 'starting', newRulesOnly: false })
  })
  it('never hides a rise behind the stamp', () => {
    const v = verdictOf(rising, 'recent')
    expect(verdictSentence(v)).toContain('has not turned yet')
    expect(verdictSentence(v)).toContain('higher than in 2016')
    expect(changeWords(falling)).toContain('lower than in 2016')
  })
})

describe('emissions.json', () => {
  const file: EmissionsFile = JSON.parse(readFileSync(resolve(__dirname, '../../public/emissions.json'), 'utf-8'))

  it('covers every country we have written up, with a verdict', () => {
    expect(file.years[0]).toBe(1990)
    for (const [name, action] of Object.entries(ACTIONS)) {
      expect(file.countries[name], name).toHaveLength(file.years.length)
      expect(countryVerdict(file, name, action.stage), name).not.toBeNull()
    }
  })

  it('matches what the data says for well-known cases', () => {
    expect(countryVerdict(file, 'United Kingdom', 'long')?.standing).toBe('improving')
    expect(countryVerdict(file, 'Germany', 'long')?.standing).toBe('improving')
    // rising CO2 with a recent pledge: starting, and flagged as new rules only
    expect(countryVerdict(file, 'India', 'recent')).toMatchObject({ standing: 'starting', newRulesOnly: true, call: 'rising' })
    expect(countryVerdict(file, 'Nowhere')).toBeNull()
  })
})
