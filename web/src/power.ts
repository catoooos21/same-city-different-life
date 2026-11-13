/**
 * NASA POWER daily point API client with an IndexedDB cache.
 *
 * Verified 2026-11-13 with a real request:
 *  - no key or login; CORS header `Access-Control-Allow-Origin: *` on GET
 *  - data starts 1981-01-01 exactly; fill value -999; units C, mm/day, %; time standard LST
 *  - up to 20 parameters per request; ~1.6 MB and ~3 s for six parameters over 45 years
 * Docs: https://power.larc.nasa.gov/docs/services/api/temporal/daily/
 */
import { PARAMS, YEARS, type Param } from './config/metrics'

export const POWER_URL = 'https://power.larc.nasa.gov/api/temporal/daily/point'
export const FILL = -999

/** Daily series from YEARS.first-01-01 to YEARS.last-12-31, NaN where missing. */
export interface DailySeries {
  lat: number
  lon: number
  /** Number of days. */
  n: number
  values: Record<Param, Float32Array>
  header: { start: string; end: string; sources?: string[]; api?: string }
  fetchedAt: string
}

export function daysBetween(y0: number, y1: number): number {
  const a = Date.UTC(y0, 0, 1)
  const b = Date.UTC(y1 + 1, 0, 1)
  return Math.round((b - a) / 86400000)
}

/** Key for the cache: POWER answers from a 0.5 x 0.625 deg grid, so two decimals is plenty. */
export function cacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`
}

export function dateKey(y: number, m: number, d: number): string {
  return `${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`
}

/** Turn the POWER JSON into compact typed arrays indexed by day since YEARS.first-01-01. */
export function parsePower(json: any, lat: number, lon: number): DailySeries {
  const n = daysBetween(YEARS.first, YEARS.last)
  const fill = json?.header?.fill_value ?? FILL
  const values = {} as Record<Param, Float32Array>
  const start = Date.UTC(YEARS.first, 0, 1)
  for (const p of PARAMS) {
    const arr = new Float32Array(n).fill(NaN)
    const series = json?.properties?.parameter?.[p]
    if (!series) throw new Error(`POWER response has no parameter ${p}`)
    for (const [k, v] of Object.entries<number>(series)) {
      const y = +k.slice(0, 4)
      const m = +k.slice(4, 6) - 1
      const d = +k.slice(6, 8)
      const i = Math.round((Date.UTC(y, m, d) - start) / 86400000)
      if (i >= 0 && i < n && v !== null && v !== fill) arr[i] = v
    }
    values[p] = arr
  }
  return {
    lat,
    lon,
    n,
    values,
    header: { start: json.header?.start, end: json.header?.end, sources: json.header?.sources, api: json.header?.api?.version },
    fetchedAt: new Date().toISOString(),
  }
}

export function powerUrl(lat: number, lon: number): string {
  const q = new URLSearchParams({
    parameters: PARAMS.join(','),
    community: 'AG',
    longitude: String(lon),
    latitude: String(lat),
    start: `${YEARS.first}0101`,
    end: `${YEARS.last}1231`,
    format: 'JSON',
  })
  return `${POWER_URL}?${q}`
}

export async function fetchPower(lat: number, lon: number, signal?: AbortSignal): Promise<DailySeries> {
  const r = await fetch(powerUrl(lat, lon), { signal })
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
  return parsePower(await r.json(), lat, lon)
}

// ---------- IndexedDB cache ----------

const DB = 'same-city'
const STORE = 'power'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no IndexedDB'))
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

interface Stored {
  lat: number
  lon: number
  n: number
  values: Record<string, ArrayBuffer>
  header: DailySeries['header']
  fetchedAt: string
}

export async function cacheGet(key: string): Promise<DailySeries | null> {
  try {
    const db = await openDb()
    const s = await new Promise<Stored | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(key)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    if (!s) return null
    const values = {} as Record<Param, Float32Array>
    for (const p of PARAMS) values[p] = new Float32Array(s.values[p])
    return { lat: s.lat, lon: s.lon, n: s.n, values, header: s.header, fetchedAt: s.fetchedAt }
  } catch {
    return null
  }
}

export async function cachePut(key: string, d: DailySeries): Promise<void> {
  try {
    const db = await openDb()
    const values: Record<string, ArrayBuffer> = {}
    for (const p of PARAMS) values[p] = d.values[p].buffer as ArrayBuffer
    const s: Stored = { lat: d.lat, lon: d.lon, n: d.n, values, header: d.header, fetchedAt: d.fetchedAt }
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(s, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    /* cache is best effort */
  }
}

/** Demo cities shipped with the site, so the demo never waits on the network. */
export interface DemoCity {
  id: string
  name: string
  country: string
  lat: number
  lon: number
}

export const DEMO_CITIES: DemoCity[] = [
  { id: 'kuwait-city', name: 'Kuwait City', country: 'Kuwait', lat: 29.3759, lon: 47.9774 },
  { id: 'london', name: 'London', country: 'United Kingdom', lat: 51.5085, lon: -0.1257 },
  { id: 'sydney', name: 'Sydney', country: 'Australia', lat: -33.8679, lon: 151.2073 },
  { id: 'delhi', name: 'Delhi', country: 'India', lat: 28.6519, lon: 77.2315 },
]

/** Compact demo file: {lat, lon, header, values: {PARAM: number[] (null for missing)}}. */
export async function fetchDemo(id: string): Promise<DailySeries | null> {
  const c = DEMO_CITIES.find((d) => d.id === id)
  if (!c) return null
  const r = await fetch(`${import.meta.env.BASE_URL}demo/${id}.json`)
  if (!r.ok) return null
  const j = await r.json()
  const n = daysBetween(YEARS.first, YEARS.last)
  const values = {} as Record<Param, Float32Array>
  for (const p of PARAMS) {
    const arr = new Float32Array(n).fill(NaN)
    const src: (number | null)[] = j.values[p]
    for (let i = 0; i < n && i < src.length; i++) if (src[i] !== null) arr[i] = src[i] as number
    values[p] = arr
  }
  return { lat: c.lat, lon: c.lon, n, values, header: j.header, fetchedAt: j.fetchedAt }
}

export type LoadStatus = { stage: 'cache' | 'demo' | 'network' | 'done'; message: string }

/** Load a city's daily series: demo file, then IndexedDB cache, then NASA POWER. */
export async function loadDaily(lat: number, lon: number, onStatus?: (s: LoadStatus) => void, signal?: AbortSignal): Promise<DailySeries> {
  const key = cacheKey(lat, lon)
  const demo = DEMO_CITIES.find((d) => cacheKey(d.lat, d.lon) === key)
  if (demo) {
    onStatus?.({ stage: 'demo', message: 'Opening the bundled copy…' })
    const d = await fetchDemo(demo.id)
    if (d) return d
  }
  onStatus?.({ stage: 'cache', message: 'Checking this browser’s cache…' })
  const cached = await cacheGet(key)
  if (cached) return cached
  onStatus?.({ stage: 'network', message: 'Asking NASA POWER for 45 years of daily weather (about 3 seconds)…' })
  const d = await fetchPower(lat, lon, signal)
  await cachePut(key, d)
  return d
}
