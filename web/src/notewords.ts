/**
 * The words on a sticky note: the "then vs now" sentence and the what-if number.
 * Pure functions, so the wording for days, mm and °C can be tested without a browser.
 */
import type { MetricDef } from './config/metrics'

/** The part of a lens metric the wording needs. */
export interface NoteWords {
  title: string
  /** Days: completes "N more/fewer ___, every year". mm and °C: starts with the unit, e.g. "mm in the biggest downpour", "°C on average". */
  phrase: string
}

/** "unusually hot days" -> "unusually hot day" when n is 1. */
function singular(phrase: string): string {
  return phrase.replace(/\b(days|nights)\b/, (w) => w.slice(0, -1))
}

/** Smallest then-vs-now difference worth a sentence: half a day, half a millimetre, a twentieth of a degree. */
export function gapThreshold(def: MetricDef): number {
  return def.unit === '°C' ? 0.05 : 0.5
}

/** Is the difference between the two periods big enough to call a gap? */
export function hasGap(def: MetricDef, diff: number | null): boolean {
  return diff !== null && Math.abs(diff) >= gapThreshold(def)
}

/** The "then vs now" sentence. */
export function noteLine(def: MetricDef, lm: NoteWords, diff: number | null): string {
  if (diff === null) return 'Not enough complete years to compare.'
  if (!hasGap(def, diff)) return `About the same ${def.unit === 'days' ? lm.phrase : lm.title.toLowerCase()}.`
  const up = diff > 0
  if (def.unit === 'days') {
    const n = Math.round(Math.abs(diff))
    return `${n} ${up ? 'more' : 'fewer'} ${n === 1 ? singular(lm.phrase) : lm.phrase}, every year.`
  }
  // "mm in the biggest downpour" -> "in the biggest downpour"; "°C on average" -> "on average"
  const rest = lm.phrase.replace(/^(mm|°C)\s+/, '')
  if (def.unit === 'mm') return `${Math.round(Math.abs(diff))} mm ${up ? 'more' : 'less'} ${rest}.`
  return `${Math.abs(diff).toFixed(1)} °C ${up ? 'warmer' : 'cooler'} ${rest}.`
}

/** A projected yearly value in words: "87 a year", "12 mm", "11.4 °C". */
export function futureWords(def: MetricDef, v: number): string {
  if (def.unit === 'days') return `${Math.round(v)} a year`
  if (def.unit === 'mm') return `${Math.round(v)} mm`
  return `${v.toFixed(1)} °C`
}
