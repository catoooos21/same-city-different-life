/**
 * Build web/public/emissions.json: each country's yearly CO2 emissions from burning oil, gas and
 * coal (territorial, million tonnes), 1990 to the latest year.
 *
 * Source: Global Carbon Budget, as published by Our World in Data (CC BY 4.0). This is NOT NASA
 * data and the app says so. Countries are keyed by their GeoNames English name (the name the city
 * search uses), matched through the ISO3 code in GeoNames countryInfo.txt.
 *
 * Run from web/:   node scripts/build_emissions.mjs
 */
import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(root, 'public/emissions.json')
const FIRST_YEAR = 1990
const OWID = 'https://ourworldindata.org/grapher/annual-co2-emissions-per-country.csv?v=1&csvType=full&useColumnShortNames=true'
const GEONAMES = 'https://download.geonames.org/export/dump/countryInfo.txt'

const text = async (url) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(120000), headers: { 'User-Agent': 'emissions-build-script' } })
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`)
  return r.text()
}

// ISO3 -> GeoNames country name
const nameOf = new Map()
for (const line of (await text(GEONAMES)).split('\n')) {
  if (line.startsWith('#') || !line.trim()) continue
  const f = line.split('\t')
  if (f[1] && f[4]) nameOf.set(f[1], f[4])
}

// OWID csv: Entity,Code,Year,<value>
const lines = (await text(OWID)).trim().split('\n')
const header = lines[0].split(',')
const iCode = header.findIndex((h) => /^code$/i.test(h.trim()))
const iYear = header.findIndex((h) => /^year$/i.test(h.trim()))
const iVal = header.length - 1
if (iCode < 0 || iYear < 0) throw new Error('unexpected OWID header: ' + lines[0])

const byCode = new Map()
for (const line of lines.slice(1)) {
  // entity names can contain commas inside quotes; code, year and value are the last three fields
  const f = line.split(',')
  const code = f[f.length - (header.length - iCode)]?.trim()
  const year = +f[f.length - (header.length - iYear)]
  const val = parseFloat(f[f.length - (header.length - iVal)])
  if (!code || code.length !== 3 || !Number.isFinite(year) || !Number.isFinite(val) || year < FIRST_YEAR) continue
  if (!byCode.has(code)) byCode.set(code, new Map())
  byCode.get(code).set(year, val)
}

let last = 0
for (const m of byCode.values()) for (const y of m.keys()) if (y > last) last = y
const years = Array.from({ length: last - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i)

const countries = {}
for (const [code, m] of byCode) {
  const name = nameOf.get(code)
  if (!name) continue
  // million tonnes, one decimal; null where a year is missing
  countries[name] = years.map((y) => (m.has(y) ? Math.round(m.get(y) / 1e5) / 10 : null))
}

writeFileSync(
  OUT,
  JSON.stringify({
    builtAt: new Date().toISOString().slice(0, 10),
    source: 'Global Carbon Budget via Our World in Data: annual CO2 emissions from fossil fuels and industry, territorial, million tonnes (CC BY 4.0)',
    url: 'https://ourworldindata.org/grapher/annual-co2-emissions-per-country',
    years,
    countries,
  }),
)
console.log(`${Object.keys(countries).length} countries, ${FIRST_YEAR}-${last} -> ${OUT}`)
