/**
 * The ground under the city: land-surface variables from the same NASA model (MERRA-2) and the
 * same service (NASA POWER) as the weather, for the same point and the same 45 years.
 *
 * Checked with real requests on 2026-11-14 (Kuwait City and a point in the Gulf):
 *  - TS "Earth Skin Temperature" in °C, GWETTOP "Surface Soil Wetness" as a fraction 0–1,
 *    EVLAND "Evaporation Land" in mm/day
 *  - all are served daily from 1981-01-01 in local solar time (community AG); no missing days
 *    in the four demo cities
 *  - CORS is open; six land parameters over 45 years were about 1.5 MB and 5 s, we ask for three
 *  - SNODP "Snow Depth" is also served but is NOT used: it is the depth inside the snow-covered
 *    part of the grid square, so it gave London 27 days a year with 10 cm of snow and a value
 *    stuck at 17.33 cm for weeks. Counting snow days from it would be wrong.
 *
 * These are the model's estimate of the ground, not measurements in the soil. The section says so.
 */
import { BASELINE, MAX_MISSING_FRACTION, YEARS, type MetricDef } from './config/metrics'
import { calendar, periodStat, type AnnualSeries, type MetricResult, type Period } from './metrics'
import { DEMO_CITIES, FILL, POWER_URL, cacheKey, daysBetween, idbGet, idbPut } from './power'
import { annualTrend } from './stats'

export type LandParam = 'TS' | 'GWETTOP' | 'EVLAND'
export const LAND_PARAMS: LandParam[] = ['TS', 'GWETTOP', 'EVLAND']

/** Daily land values indexed by day since YEARS.first-01-01, NaN where missing. */
export interface LandDaily {
  lat: number
  lon: number
  n: number
  values: Record<LandParam, Float32Array>
  fetchedAt: string
}

export function landUrl(lat: number, lon: number): string {
  const q = new URLSearchParams({
    parameters: LAND_PARAMS.join(','),
    community: 'AG',
    longitude: String(lon),
    latitude: String(lat),
    start: `${YEARS.first}0101`,
    end: `${YEARS.last}1231`,
    format: 'JSON',
  })
  return `${POWER_URL}?${q}`
}

function blank(): Float32Array {
  return new Float32Array(daysBetween(YEARS.first, YEARS.last)).fill(NaN)
}

/** POWER JSON (values keyed by YYYYMMDD) -> arrays on the app's day index. */
export function parseLand(json: any, lat: number, lon: number): LandDaily {
  const fill = json?.header?.fill_value ?? FILL
  const start = Date.UTC(YEARS.first, 0, 1)
  const values = {} as Record<LandParam, Float32Array>
  for (const p of LAND_PARAMS) {
    const series = json?.properties?.parameter?.[p]
    if (!series) throw new Error(`POWER response has no parameter ${p}`)
    const arr = blank()
    for (const [k, v] of Object.entries<number>(series)) {
      const i = Math.round((Date.UTC(+k.slice(0, 4), +k.slice(4, 6) - 1, +k.slice(6, 8)) - start) / 86400000)
      if (i >= 0 && i < arr.length && v !== null && v !== fill) arr[i] = v
    }
    values[p] = arr
  }
  if (!values.TS.some((v) => !Number.isNaN(v))) throw new Error('NASA POWER returned no land data for this place.')
  return { lat, lon, n: values.TS.length, values, fetchedAt: new Date().toISOString() }
}

/** Bundled demo copy: arrays that start on `first`-01-01, null where missing (scripts/build_land_demo.mjs). */
export function parseDemoLand(j: any, lat: number, lon: number): LandDaily {
  const offset = daysBetween(YEARS.first, (j.first ?? YEARS.first) - 1)
  const values = {} as Record<LandParam, Float32Array>
  for (const p of LAND_PARAMS) {
    const arr = blank()
    const src: (number | null)[] = j.values[p]
    for (let i = 0; i < src.length && offset + i < arr.length; i++) if (src[i] !== null) arr[offset + i] = src[i] as number
    values[p] = arr
  }
  return { lat, lon, n: daysBetween(YEARS.first, YEARS.last), values, fetchedAt: j.fetchedAt }
}

async function fetchLand(lat: number, lon: number, signal?: AbortSignal): Promise<LandDaily> {
  const r = await fetch(landUrl(lat, lon), { signal })
  if (!r.ok) {
    let msg = `NASA POWER returned HTTP ${r.status}`
    try {
      const j = await r.json()
      if (j?.messages) msg += `: ${j.messages.join(' ')}`
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }
  return parseLand(await r.json(), lat, lon)
}

interface StoredLand {
  lat: number
  lon: number
  n: number
  values: Record<string, ArrayBuffer>
  fetchedAt: string
}

/** Demo file, then this browser's cache, then NASA POWER. */
export async function loadLand(lat: number, lon: number, signal?: AbortSignal): Promise<LandDaily> {
  const key = cacheKey(lat, lon)
  const demo = DEMO_CITIES.find((d) => cacheKey(d.lat, d.lon) === key)
  if (demo) {
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}demo/${demo.id}.land.json`, { signal })
      if (r.ok) return parseDemoLand(await r.json(), demo.lat, demo.lon)
    } catch {
      /* fall through to the network */
    }
  }
  const stored = await idbGet<StoredLand>(`${key}|land`)
  if (stored && LAND_PARAMS.every((p) => stored.values?.[p])) {
    const values = {} as Record<LandParam, Float32Array>
    for (const p of LAND_PARAMS) values[p] = new Float32Array(stored.values[p])
    return { ...stored, values }
  }
  const d = await fetchLand(lat, lon, signal)
  const buffers: Record<string, ArrayBuffer> = {}
  for (const p of LAND_PARAMS) buffers[p] = d.values[p].buffer as ArrayBuffer
  await idbPut(`${key}|land`, { lat: d.lat, lon: d.lon, n: d.n, values: buffers, fetchedAt: d.fetchedAt } satisfies StoredLand)
  return d
}

// ---------- the measures ----------

export interface LandMeasure {
  /**
   * Worded like the app's other measures so the shared stamp, sparkline and chart can draw it.
   * `needs` and `compute` belong to the weather engine and are not used for land.
   */
  def: MetricDef
  param: LandParam
  /** Yearly number: average of the days, or total of the days. */
  kind: 'mean' | 'sum'
  /** Multiply each daily value (soil wetness is served 0–1 and shown in %). */
  scale?: number
  /** Decimals for the yearly value. */
  digits: number
}

/** Land measures do not go through the weather engine, so these two fields are placeholders. */
const NOT_WEATHER = { needs: [], compute: { kind: 'mean', value: () => NaN } } as Pick<MetricDef, 'needs' | 'compute'>

export const LAND_MEASURES: LandMeasure[] = [
  {
    param: 'TS',
    kind: 'mean',
    digits: 1,
    def: {
      ...NOT_WEATHER,
      id: 'ground_temp',
      name: 'Ground temperature',
      plain: 'How hot the surface of the ground is, day and night, averaged over the year.',
      unit: '°C',
      unitLong: '°C, yearly average',
      definition: 'Annual mean of the daily mean skin temperature of the Earth’s surface (POWER parameter TS), in °C. The air temperature on the rest of the page is measured 2 m above it.',
    },
  },
  {
    param: 'GWETTOP',
    kind: 'mean',
    scale: 100,
    digits: 1,
    def: {
      ...NOT_WEATHER,
      id: 'soil_wetness',
      name: 'Soil wetness',
      plain: 'How wet the top of the soil is: 0 % is bone dry, 100 % is soaked.',
      // the weather engine only knows days, mm and °C; the shared wording code prints any other unit as it is
      unit: '%' as MetricDef['unit'],
      unitLong: '% of soaked, yearly average',
      definition: 'Annual mean of the daily surface soil wetness (POWER parameter GWETTOP: top 5 cm of soil; 0 = no water, 1 = saturated), shown in %.',
    },
  },
  {
    param: 'EVLAND',
    kind: 'sum',
    digits: 0,
    def: {
      ...NOT_WEATHER,
      id: 'land_evaporation',
      name: 'Water the ground gives back',
      plain: 'Water that leaves the soil and plants for the air, added up over the year.',
      unit: 'mm',
      unitLong: 'mm in the year',
      definition: 'Total evaporation from the land surface over the calendar year (POWER parameter EVLAND, mm/day summed), in mm. When a few days are missing the total is scaled to a full year.',
    },
  },
]

/** One number per year; a year with more than MAX_MISSING_FRACTION of its days missing is dropped. */
export function landAnnual(m: LandMeasure, d: LandDaily): AnnualSeries {
  const cal = calendar(d.n)
  const arr = d.values[m.param]
  const scale = m.scale ?? 1
  const years: number[] = []
  const values: (number | null)[] = []
  const missing: number[] = []
  for (let y = YEARS.first; y <= YEARS.last; y++) {
    const i0 = cal.yearStart.get(y)!
    const len = cal.yearLength.get(y)!
    let sum = 0
    let k = 0
    for (let i = i0; i < i0 + len; i++) {
      const v = arr[i]
      if (Number.isNaN(v)) continue
      k++
      sum += v * scale
    }
    const frac = (len - k) / len
    years.push(y)
    missing.push(frac)
    if (frac > MAX_MISSING_FRACTION || k === 0) values.push(null)
    else values.push(m.kind === 'mean' ? sum / k : (sum * len) / k)
  }
  return { years, values, missing }
}

/** One land measure with the same trend test and the same then/now periods as the rest of the page. */
export function landResult(m: LandMeasure, d: LandDaily, then: Period, now: Period): MetricResult {
  const annual = landAnnual(m, d)
  const trend = annualTrend(annual.years, annual.values)
  const base = periodStat(annual, BASELINE)
  const thenS = periodStat(annual, then)
  const nowS = periodStat(annual, now)
  return {
    def: m.def,
    annual,
    trend,
    slopePerDecade: trend ? trend.slope * 10 : null,
    ciPerDecade: trend ? [trend.ci[0] * 10, trend.ci[1] * 10] : null,
    baselineMean: base.mean,
    shown: m.def.showIf ? base.mean !== null && m.def.showIf(base.mean) : true,
    then: thenS,
    now: nowS,
    diff: thenS.mean !== null && nowS.mean !== null ? nowS.mean - thenS.mean : null,
  }
}

export interface LandRow {
  measure: LandMeasure
  result: MetricResult
}

/** Every land measure for this place. */
export function groundStory(d: LandDaily, then: Period, now: Period): LandRow[] {
  return LAND_MEASURES.map((measure) => ({ measure, result: landResult(measure, d, then, now) })).filter((r) => r.result.shown)
}
