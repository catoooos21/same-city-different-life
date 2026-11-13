import { useEffect, useRef, useState } from 'react'
import type { City } from '../state'

type Row = [string, string, string, number, number, number] // name, ascii, country, lat, lon, pop

let cache: Row[] | null = null
let loading: Promise<Row[]> | null = null

function loadCities(): Promise<Row[]> {
  if (cache) return Promise.resolve(cache)
  if (!loading)
    loading = fetch(`${import.meta.env.BASE_URL}cities.json`)
      .then((r) => r.json())
      .then((rows: Row[]) => (cache = rows))
  return loading
}

/**
 * Display name: GeoNames "name" keeps transliteration marks such as "Ḩawallī"; use the ASCII
 * name when the name has characters beyond Latin Extended-B, keep "São Paulo"-style names.
 */
function displayName(name: string, ascii: string): string {
  return /[^\u0000-ɏ]/.test(name) ? ascii : name
}

function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function search(rows: Row[], q: string): Row[] {
  const f = fold(q.trim())
  if (!f) return []
  const starts: Row[] = []
  const words: Row[] = []
  for (const r of rows) {
    const a = fold(r[0])
    const b = fold(r[1])
    if (a.startsWith(f) || b.startsWith(f)) starts.push(r)
    else if (a.includes(' ' + f) || b.includes(' ' + f) || fold(r[2]).startsWith(f)) words.push(r)
    if (starts.length >= 8) break
  }
  return [...starts, ...words].slice(0, 8)
}

export function CitySearch({ value, onChange, autoFocus }: { value: City | null; onChange: (c: City) => void; autoFocus?: boolean }) {
  const [text, setText] = useState(value ? `${value.name}, ${value.country}` : '')
  const [rows, setRows] = useState<Row[]>([])
  const [hits, setHits] = useState<Row[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [coords, setCoords] = useState(false)
  const [lat, setLat] = useState(value ? String(value.lat) : '')
  const [lon, setLon] = useState(value ? String(value.lon) : '')
  const box = useRef<HTMLDivElement>(null)
  const typed = useRef(false)

  useEffect(() => {
    if (value) setText(value.country ? `${value.name}, ${value.country}` : value.name)
  }, [value])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  function ensure() {
    if (!rows.length) loadCities().then(setRows)
  }

  function update(t: string) {
    setText(t)
    typed.current = true
    ensure()
    const r = rows.length ? rows : cache ?? []
    const h = search(r, t)
    setHits(h)
    setActive(0)
    setOpen(h.length > 0)
  }

  // The city list loads lazily; once it arrives, search whatever the user has typed so far.
  useEffect(() => {
    if (rows.length && text && typed.current) {
      const h = search(rows, text)
      setHits(h)
      setOpen(h.length > 0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])

  function pick(r: Row) {
    const name = displayName(r[0], r[1])
    typed.current = false
    onChange({ name, country: r[2], lat: r[3], lon: r[4] })
    setText(`${name}, ${r[2]}`)
    setOpen(false)
  }

  function useCoords() {
    const a = parseFloat(lat)
    const b = parseFloat(lon)
    if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180) return
    onChange({ name: `${a.toFixed(2)}, ${b.toFixed(2)}`, country: '', lat: a, lon: b })
    setCoords(false)
  }

  return (
    <div className="citysearch" ref={box}>
      {!coords ? (
        <>
          <input
            className="city-input"
            type="search"
            placeholder="Pick a city…"
            value={text}
            autoFocus={autoFocus}
            autoComplete="off"
            onFocus={() => {
              ensure()
              if (hits.length) setOpen(true)
            }}
            onChange={(e) => update(e.target.value)}
            onKeyDown={(e) => {
              if (!open) return
              if (e.key === 'ArrowDown') (e.preventDefault(), setActive((a) => Math.min(a + 1, hits.length - 1)))
              else if (e.key === 'ArrowUp') (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)))
              else if (e.key === 'Enter') (e.preventDefault(), hits[active] && pick(hits[active]))
              else if (e.key === 'Escape') setOpen(false)
            }}
            aria-label="City"
          />
          {open && (
            <ul className="city-list" role="listbox">
              {hits.map((r, i) => (
                <li key={`${r[0]}-${r[3]}-${r[4]}`} role="option" aria-selected={i === active} className={i === active ? 'active' : ''} onMouseDown={() => pick(r)}>
                  <span>{displayName(r[0], r[1])}</span>
                  <small>{r[2]}</small>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="linkish" onClick={() => setCoords(true)}>
            or use coordinates
          </button>
        </>
      ) : (
        <div className="coords">
          <input type="number" step="0.01" min={-90} max={90} placeholder="latitude" value={lat} onChange={(e) => setLat(e.target.value)} aria-label="Latitude" />
          <input type="number" step="0.01" min={-180} max={180} placeholder="longitude" value={lon} onChange={(e) => setLon(e.target.value)} aria-label="Longitude" />
          <button type="button" className="btn small" onClick={useCoords}>
            Use these
          </button>
          <button type="button" className="linkish" onClick={() => setCoords(false)}>
            back to search
          </button>
        </div>
      )}
    </div>
  )
}
