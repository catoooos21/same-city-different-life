/**
 * A second opinion on rain: NASA's GPM IMERG satellite rain next to the MERRA-2 model rain that
 * the rest of the app uses. Both come from NASA POWER, for the same point.
 *
 * Checked with real requests on 2026-11-14:
 *  - parameter IMERG_PRECTOT (mm/day) is only served with time-standard=utc; in local solar time
 *    POWER answers with fill values and the message "not available at the LST standard"
 *  - it starts on 1998-01-01 (1997 and earlier are fill values); no missing days in the demo cities
 *  - CORS is open; both parameters for 28 years are about 160 KB and 2 s
 *
 * To compare like with like, MERRA-2 rain is requested again here in UTC days, and both sources
 * are measured over the same years with the same metric definitions and the same trend test.
 */
import { METRIC_BY_ID, PARAMS, YEARS, type Param } from './config/metrics'
import { callOf, matchCalls, type Match } from './casefile'
import { annualSeries, periodStat, type MetricResult } from './metrics'
import { DEMO_CITIES, POWER_URL, FILL, cacheKey, daysBetween, idbGet, idbPut, type DailySeries } from './power'
import { annualTrend } from './stats'

/** Years the satellite record covers in full. */
export const GPM_YEARS = { first: 1998, last: YEARS.last }
/** The rain-only measures, basics first. */
export const RAIN_IDS = ['rain_total', 'rainy_days', 'heavy_rain_days', 'biggest_downpour', 'longest_dry_spell']

const SATELLITE = 'IMERG_PRECTOT'
const MODEL = 'PRECTOTCORR'

/** Daily rain from both sources, indexed by day since YEARS.first-01-01; NaN before GPM_YEARS.first and where missing. */
export interface RainDaily {
  lat: number
  lon: number
  n: number
  satellite: Float32Array
  model: Float32Array
  fetchedAt: string
}

export function rainUrl(lat: number, lon: number): string {
  const q = new URLSearchParams({
    parameters: `${SATELLITE},${MODEL}`,
    community: 'AG',
    longitude: String(lon),
    latitude: String(lat),
    start: `${GPM_YEARS.first}0101`,
    end: `${GPM_YEARS.last}1231`,
    format: 'JSON',
    'time-standard': 'utc',
  })
  return `${POWER_URL}?${q}`
}

function blank(): Float32Array {
  return new Float32Array(daysBetween(YEARS.first, YEARS.last)).fill(NaN)
}

/** POWER JSON (values keyed by YYYYMMDD) -> arrays on the app's day index. */
export function parseRain(json: any, lat: number, lon: number): RainDaily {
  const fill = json?.header?.fill_value ?? FILL
  const start = Date.UTC(YEARS.first, 0, 1)
  const read = (p: string): Float32Array => {
    const series = json?.properties?.parameter?.[p]
    if (!series) throw new Error(`POWER response has no parameter ${p}`)
    const arr = blank()
    for (const [k, v] of Object.entries<number>(series)) {
      const i = Math.round((Date.UTC(+k.slice(0, 4), +k.slice(4, 6) - 1, +k.slice(6, 8)) - start) / 86400000)
      if (i >= 0 && i < arr.length && v !== null && v !== fill) arr[i] = v
    }
    return arr
  }
  const satellite = read(SATELLITE)
  if (!satellite.some((v) => !Number.isNaN(v))) throw new Error('NASA POWER returned no satellite rain for this place.')
  return { lat, lon, n: satellite.length, satellite, model: read(MODEL), fetchedAt: new Date().toISOString() }
}

/** Bundled demo copy: arrays that start on GPM_YEARS.first-01-01, null where missing. */
export function parseDemoRain(j: any, lat: number, lon: number): RainDaily {
  const offset = daysBetween(YEARS.first, (j.first ?? GPM_YEARS.first) - 1)
  const read = (p: string): Float32Array => {
    const arr = blank()
    const src: (number | null)[] = j.values[p]
    for (let i = 0; i < src.length && offset + i < arr.length; i++) if (src[i] !== null) arr[offset + i] = src[i] as number
    return arr
  }
  return { lat, lon, n: daysBetween(YEARS.first, YEARS.last), satellite: read(SATELLITE), model: read(MODEL), fetchedAt: j.fetchedAt }
}

async function fetchRain(lat: number, lon: number, signal?: AbortSignal): Promise<RainDaily> {
  const r = await fetch(rainUrl(lat, lon), { signal })
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
  return parseRain(await r.json(), lat, lon)
}

interface StoredRain {
  lat: number
  lon: number
  n: number
  satellite: ArrayBuffer
  model: ArrayBuffer
  fetchedAt: string
}

/** Demo file, then this browser's cache, then NASA POWER. */
export async function loadRain(lat: number, lon: number, signal?: AbortSignal): Promise<RainDaily> {
  const key = cacheKey(lat, lon)
  const demo = DEMO_CITIES.find((d) => cacheKey(d.lat, d.lon) === key)
  if (demo) {
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}demo/${demo.id}.rain.json`, { signal })
      if (r.ok) return parseDemoRain(await r.json(), demo.lat, demo.lon)
    } catch {
      /* fall through to the network */
    }
  }
  const stored = await idbGet<StoredRain>(`${key}|rain`)
  if (stored) return { ...stored, satellite: new Float32Array(stored.satellite), model: new Float32Array(stored.model) }
  const d = await fetchRain(lat, lon, signal)
  await idbPut(`${key}|rain`, { ...d, satellite: d.satellite.buffer as ArrayBuffer, model: d.model.buffer as ArrayBuffer } satisfies StoredRain)
  return d
}

// ---------- the comparison ----------

/** The app's yearly-series code reads a DailySeries, so dress one rain array up as one. Only rain is filled. */
function asDaily(rain: Float32Array, r: RainDaily): DailySeries {
  const empty = blank()
  const values = {} as Record<Param, Float32Array>
  for (const p of PARAMS) values[p] = p === MODEL ? rain : empty
  return { lat: r.lat, lon: r.lon, n: r.n, values, header: { start: '', end: '' }, fetchedAt: r.fetchedAt }
}

/** Rain metrics need no city thresholds. */
const NO_CONTEXT = { p90max: NaN, p90min: NaN }

/** One rain measure from one source: yearly values GPM_YEARS only, trend over those years. */
export function rainResult(id: string, rain: Float32Array, r: RainDaily): MetricResult {
  const def = METRIC_BY_ID[id]
  const annual = annualSeries(def, asDaily(rain, r), NO_CONTEXT)
  const trend = annualTrend(annual.years, annual.values)
  const typical = periodStat(annual, GPM_YEARS)
  return {
    def,
    annual,
    trend,
    slopePerDecade: trend ? trend.slope * 10 : null,
    ciPerDecade: trend ? [trend.ci[0] * 10, trend.ci[1] * 10] : null,
    baselineMean: typical.mean,
    shown: true,
    // "then" and "now" have no meaning here; both hold the typical year over the satellite era
    then: typical,
    now: typical,
    diff: null,
  }
}

export interface RainRow {
  id: string
  satellite: MetricResult
  model: MetricResult
  /** A = satellite, B = model. */
  match: Match
}

export function secondOpinion(r: RainDaily): RainRow[] {
  return RAIN_IDS.map((id) => {
    const satellite = rainResult(id, r.satellite, r)
    const model = rainResult(id, r.model, r)
    return { id, satellite, model, match: matchCalls(callOf(satellite), callOf(model)) }
  })
}

/** The two sources agree when both see the same direction, or both see no clear change. */
export function agrees(m: Match): boolean {
  return m === 'same' || m === 'neither'
}
