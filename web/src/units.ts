/**
 * How a metric's numbers are worded. One place, so a measure in °C or mm reads correctly on a
 * tile, in a trend sentence, on a chart axis and in a what-if.
 */
import type { MetricDef } from './config/metrics'

/** Short unit for a rate or a chart axis: "days", "mm", "°C". `n` picks "day" for exactly one. */
export function unitShort(def: MetricDef, n?: number): string {
  if (def.unit !== 'days') return def.unit
  return n !== undefined && Math.abs(n) === 1 ? 'day' : 'days'
}

/** What the big number on a tile means: "days a year", "mm on the wettest day", "°C, yearly average". */
export function unitLong(def: MetricDef): string {
  return def.unitLong ?? (def.unit === 'days' ? 'days a year' : def.unit)
}

/** Decimals worth showing for a change per ten years: temperature moves in tenths of a degree. */
export function rateDigits(def: MetricDef, n: number): number {
  if (def.unit === '°C') return 2
  return Math.abs(n) < 2 ? 1 : 0
}

/** Decimals for the yearly value itself. */
export function valueDigits(def: MetricDef): number {
  return def.unit === '°C' ? 1 : 0
}

/** Keep an extrapolated value inside what the unit allows. Temperature may be negative; days and rain may not. */
export function clampValue(def: MetricDef, v: number): number {
  if (def.unit === 'days') return Math.max(0, Math.min(366, v))
  if (def.unit === 'mm') return Math.max(0, v)
  return v
}

/** Counts and rain start at zero on a chart; temperature does not (27 °C against 28 °C would look flat). */
export function axisFromZero(def: MetricDef): boolean {
  return def.unit !== '°C'
}
