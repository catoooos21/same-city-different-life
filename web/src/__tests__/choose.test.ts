import { describe, expect, it } from 'vitest'
import { METRICS, METRIC_BY_ID } from '../config/metrics'
import { CUSTOM_LENS_ID, CUSTOM_WORDS, DEFAULT_PICK, LENSES, LENS_BY_ID, cleanPick, customLens, lensFor } from '../config/lenses'
import { futureWords, hasGap, noteLine } from '../notewords'
import { parseHash, toHash } from '../state'

const words = (id: string) => CUSTOM_WORDS[id]
const kid = (id: string) => LENS_BY_ID.kid.metrics.find((m) => m.metric === id)!
const farmer = (id: string) => LENS_BY_ID.farmer.metrics.find((m) => m.metric === id)!

describe('sticky-note sentences', () => {
  it('keeps the sentences the ready-made lenses already had', () => {
    const hot = METRIC_BY_ID.hot_days
    expect(noteLine(hot, kid('hot_days'), 37.4)).toBe('37 more unusually hot days, every year.')
    expect(noteLine(hot, kid('hot_days'), 1.2)).toBe('1 more unusually hot day, every year.')
    expect(noteLine(hot, kid('hot_days'), -9)).toBe('9 fewer unusually hot days, every year.')
    expect(noteLine(hot, kid('hot_days'), 0.3)).toBe('About the same unusually hot days.')
    expect(noteLine(hot, kid('hot_days'), null)).toBe('Not enough complete years to compare.')
    const wet = METRIC_BY_ID.biggest_downpour
    expect(noteLine(wet, farmer('biggest_downpour'), 12.3)).toBe('12 mm more in the biggest downpour.')
    expect(noteLine(wet, farmer('biggest_downpour'), -4)).toBe('4 mm less in the biggest downpour.')
    expect(noteLine(wet, farmer('biggest_downpour'), 0.2)).toBe('About the same biggest downpour.')
  })

  it('words temperature in degrees, with one decimal', () => {
    const t = METRIC_BY_ID.mean_temp
    expect(noteLine(t, words('mean_temp'), 1.23)).toBe('1.2 °C warmer on average.')
    expect(noteLine(t, words('mean_temp'), -0.4)).toBe('0.4 °C cooler on average.')
    expect(noteLine(t, words('mean_temp'), 0.03)).toBe('About the same average temperature.')
    expect(noteLine(METRIC_BY_ID.mean_tmax, words('mean_tmax'), 1.4)).toBe('1.4 °C warmer in the daytime highs.')
    expect(noteLine(METRIC_BY_ID.mean_tmin, words('mean_tmin'), 1.1)).toBe('1.1 °C warmer in the night-time lows.')
  })

  it('words yearly rain in millimetres', () => {
    const r = METRIC_BY_ID.rain_total
    expect(noteLine(r, words('rain_total'), 48.2)).toBe('48 mm more rain over the year.')
    expect(noteLine(r, words('rain_total'), -17)).toBe('17 mm less rain over the year.')
    expect(noteLine(r, words('rain_total'), 0.1)).toBe('About the same rain in the year.')
  })

  it('calls a gap at half a day or half a millimetre, but at a twentieth of a degree', () => {
    expect(hasGap(METRIC_BY_ID.hot_days, 0.4)).toBe(false)
    expect(hasGap(METRIC_BY_ID.hot_days, 0.5)).toBe(true)
    expect(hasGap(METRIC_BY_ID.rain_total, -0.6)).toBe(true)
    expect(hasGap(METRIC_BY_ID.mean_temp, 0.4)).toBe(true)
    expect(hasGap(METRIC_BY_ID.mean_temp, 0.04)).toBe(false)
    expect(hasGap(METRIC_BY_ID.mean_temp, null)).toBe(false)
  })

  it('words a what-if number in its own unit', () => {
    expect(futureWords(METRIC_BY_ID.hot_days, 86.6)).toBe('87 a year')
    expect(futureWords(METRIC_BY_ID.biggest_downpour, 12.4)).toBe('12 mm')
    expect(futureWords(METRIC_BY_ID.mean_temp, 11.44)).toBe('11.4 °C')
  })
})

describe('choose your own measures', () => {
  it('has wording for every measure in the app', () => {
    for (const m of METRICS) {
      const w = CUSTOM_WORDS[m.id]
      expect(w, m.id).toBeDefined()
      // the phrase must start with the unit for mm and °C, so the sentence builder can place it
      if (m.unit !== 'days') expect(w.phrase.startsWith(`${m.unit} `), m.id).toBe(true)
    }
    expect(Object.keys(CUSTOM_WORDS).sort()).toEqual(METRICS.map((m) => m.id).sort())
  })

  it('is offered as a seventh lens, starting with the two basics and two counts', () => {
    expect(LENSES.map((l) => l.id)).toContain(CUSTOM_LENS_ID)
    expect(LENSES).toHaveLength(7)
    expect(LENS_BY_ID[CUSTOM_LENS_ID].metrics.map((m) => m.metric)).toEqual(DEFAULT_PICK)
  })

  it('cleans a list: known ids only, no repeats, fixed order, never empty', () => {
    expect(cleanPick(['rainy_days', 'mean_temp', 'rainy_days', 'nonsense'])).toEqual(['mean_temp', 'rainy_days'])
    expect(cleanPick([])).toEqual(DEFAULT_PICK)
    expect(cleanPick([''])).toEqual(DEFAULT_PICK)
  })

  it('builds the lens from the list, and leaves ready-made lenses alone', () => {
    const lens = customLens(['frost_days', 'mean_tmin'])
    expect(lens.id).toBe(CUSTOM_LENS_ID)
    expect(lens.metrics.map((m) => m.metric)).toEqual(['mean_tmin', 'frost_days'])
    expect(lens.metrics[0].title).toBe('Average night-time low')
    expect(lensFor(CUSTOM_LENS_ID, ['sticky_days']).metrics.map((m) => m.metric)).toEqual(['sticky_days'])
    expect(lensFor('kid', ['sticky_days'])).toBe(LENS_BY_ID.kid)
  })

  it('keeps the list in the link only for the custom lens', () => {
    const h = '#name=London&lat=51.5085&lon=-0.1257&lens=custom&pick=rainy_days,mean_temp,bogus'
    const q = parseHash(h)
    expect(q.lens).toBe(CUSTOM_LENS_ID)
    expect(q.pick).toEqual(['mean_temp', 'rainy_days'])
    expect(toHash(q)).toContain('pick=mean_temp%2Crainy_days')
    expect(parseHash(toHash(q)).pick).toEqual(q.pick)
    // no list given -> the default; another lens -> no pick in the link
    expect(parseHash('#lat=1&lon=1&lens=custom').pick).toEqual(DEFAULT_PICK)
    expect(toHash(parseHash('#lat=1&lon=1&lens=kid'))).not.toContain('pick')
  })
})
