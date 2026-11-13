/** App state lives in the URL hash so any result can be shared as a link. */
import { BIRTH_YEARS, YEARS } from './config/metrics'
import { LENSES } from './config/lenses'
import { childhood, type Period } from './metrics'

export interface City {
  name: string
  country: string
  lat: number
  lon: number
}

export interface Query {
  city: City | null
  mode: 'child' | 'free'
  b1: number
  b2: number
  p1: Period
  p2: Period
  lens: string
}

export const DEFAULT_QUERY: Query = {
  city: null,
  mode: 'child',
  b1: 1981,
  b2: 2015,
  p1: { first: 1981, last: 1990 },
  p2: { first: 2016, last: 2025 },
  lens: 'kid',
}

export function periods(q: Query): { then: Period; now: Period } {
  return q.mode === 'child' ? { then: childhood(q.b1), now: childhood(q.b2) } : { then: q.p1, now: q.p2 }
}

function clampYear(v: number, lo: number, hi: number, dflt: number): number {
  return Number.isFinite(v) && v >= lo && v <= hi ? Math.round(v) : dflt
}

export function parseHash(hash: string): Query {
  const p = new URLSearchParams(hash.replace(/^#/, ''))
  const q: Query = { ...DEFAULT_QUERY, p1: { ...DEFAULT_QUERY.p1 }, p2: { ...DEFAULT_QUERY.p2 } }
  const lat = parseFloat(p.get('lat') ?? '')
  const lon = parseFloat(p.get('lon') ?? '')
  if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
    q.city = { name: p.get('name') ?? `${lat.toFixed(2)}, ${lon.toFixed(2)}`, country: p.get('country') ?? '', lat, lon }
  }
  q.mode = p.get('mode') === 'free' ? 'free' : 'child'
  q.b1 = clampYear(+(p.get('b1') ?? ''), BIRTH_YEARS.first, BIRTH_YEARS.last, DEFAULT_QUERY.b1)
  q.b2 = clampYear(+(p.get('b2') ?? ''), BIRTH_YEARS.first, BIRTH_YEARS.last, DEFAULT_QUERY.b2)
  const rng = (s: string | null, d: Period): Period => {
    const m = /^(\d{4})-(\d{4})$/.exec(s ?? '')
    if (!m) return d
    const a = clampYear(+m[1], YEARS.first, YEARS.last, d.first)
    const b = clampYear(+m[2], YEARS.first, YEARS.last, d.last)
    return a <= b ? { first: a, last: b } : d
  }
  q.p1 = rng(p.get('then'), q.p1)
  q.p2 = rng(p.get('now'), q.p2)
  const lens = p.get('lens') ?? ''
  q.lens = LENSES.some((l) => l.id === lens) ? lens : DEFAULT_QUERY.lens
  return q
}

export function toHash(q: Query): string {
  const p = new URLSearchParams()
  if (q.city) {
    p.set('name', q.city.name)
    if (q.city.country) p.set('country', q.city.country)
    p.set('lat', q.city.lat.toFixed(4))
    p.set('lon', q.city.lon.toFixed(4))
  }
  p.set('mode', q.mode)
  if (q.mode === 'child') {
    p.set('b1', String(q.b1))
    p.set('b2', String(q.b2))
  } else {
    p.set('then', `${q.p1.first}-${q.p1.last}`)
    p.set('now', `${q.p2.first}-${q.p2.last}`)
  }
  p.set('lens', q.lens)
  return '#' + p.toString()
}
