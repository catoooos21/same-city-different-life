// Bundles the land-surface data for the demo cities, so "The ground under the city" opens
// without waiting on the network. Run from web/:  node scripts/build_land_demo.mjs
//
// Source: NASA POWER daily point API (MERRA-2), the same service as the weather.
// Output: public/demo/<id>.land.json = { first, timeStandard, fetchedAt, lat, lon, values: {PARAM: number[] (null = missing)} }
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Keep in step with DEMO_CITIES in src/power.ts and LAND_PARAMS in src/land.ts (a test checks every demo city has a file).
const CITIES = [
  { id: 'kuwait-city', lat: 29.3759, lon: 47.9774 },
  { id: 'london', lat: 51.5085, lon: -0.1257 },
  { id: 'sydney', lat: -33.8679, lon: 151.2073 },
  { id: 'delhi', lat: 28.6519, lon: 77.2315 },
]
const PARAMS = ['TS', 'GWETTOP', 'EVLAND']
const FIRST = 1981
const LAST = 2025

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../public/demo')

for (const c of CITIES) {
  const q = new URLSearchParams({
    parameters: PARAMS.join(','),
    community: 'AG',
    longitude: String(c.lon),
    latitude: String(c.lat),
    start: `${FIRST}0101`,
    end: `${LAST}1231`,
    format: 'JSON',
  })
  const r = await fetch(`https://power.larc.nasa.gov/api/temporal/daily/point?${q}`)
  if (!r.ok) throw new Error(`${c.id}: NASA POWER returned HTTP ${r.status}`)
  const json = await r.json()
  const fill = json.header?.fill_value ?? -999
  const values = {}
  for (const p of PARAMS) {
    const series = json.properties?.parameter?.[p]
    if (!series) throw new Error(`${c.id}: no parameter ${p}`)
    // POWER lists the days in order; check the first and the count so the array index is the day index
    const keys = Object.keys(series)
    const days = Math.round((Date.UTC(LAST + 1, 0, 1) - Date.UTC(FIRST, 0, 1)) / 86400000)
    if (keys[0] !== `${FIRST}0101` || keys.length !== days) throw new Error(`${c.id} ${p}: expected ${days} days from ${FIRST}0101, got ${keys.length} from ${keys[0]}`)
    values[p] = keys.map((k) => (series[k] === fill || series[k] === null ? null : series[k]))
  }
  const file = resolve(out, `${c.id}.land.json`)
  writeFileSync(file, JSON.stringify({ first: FIRST, timeStandard: 'LST', fetchedAt: new Date().toISOString(), lat: c.lat, lon: c.lon, values }))
  const missing = PARAMS.map((p) => `${p} ${values[p].filter((v) => v === null).length}`).join(', ')
  console.log(`${c.id}: ${values[PARAMS[0]].length} days, missing: ${missing}`)
}
