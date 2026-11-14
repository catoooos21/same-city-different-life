/**
 * Build web/public/countries.json: one row per country, measured at its capital city.
 *
 * For every country in public/cities.json (GeoNames, cities over 100,000 people) this takes the
 * capital (or the most populous city when the capital is not in that list), asks NASA POWER for the same 45 years of daily data the app uses, and runs
 * the app's own metric and trend code on it (loaded through Vite, so there is one implementation).
 *
 * Run from web/:   node scripts/build_countries.mjs
 * Re-running resumes: finished countries are kept in the output file and skipped.
 * Options:  --only "Kuwait,Egypt"   --refresh (ignore the existing file)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(root, 'public/countries.json')
const CONCURRENCY = 4
const RETRIES = 4

const args = process.argv.slice(2)
const only = args.includes('--only') ? new Set(args[args.indexOf('--only') + 1].split(',').map((s) => s.trim())) : null
const refresh = args.includes('--refresh')

const server = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { analyse } = await server.ssrLoadModule('/src/metrics.ts')
const { parsePower, powerUrl } = await server.ssrLoadModule('/src/power.ts')
const { summarise } = await server.ssrLoadModule('/src/countries.ts')

// cities.json rows: [name, asciiName, country, lat, lon, population], most populous first
const cities = JSON.parse(readFileSync(resolve(root, 'public/cities.json'), 'utf-8'))
const largest = new Map()
for (const [name, , country, lat, lon, pop] of cities) if (country && !largest.has(country)) largest.set(country, { country, city: name, lat, lon, pop })

// Prefer the capital (GeoNames countryInfo.txt: column 4 = country name, column 5 = capital);
// fall back to the most populous city when the capital is not in the over-100,000 list.
const capitalOf = new Map()
try {
  const info = await (await fetch('https://download.geonames.org/export/dump/countryInfo.txt', { signal: AbortSignal.timeout(60000) })).text()
  for (const line of info.split('\n')) {
    if (line.startsWith('#') || !line.trim()) continue
    const f = line.split('\t')
    if (f[4] && f[5]) capitalOf.set(f[4], f[5])
  }
} catch (e) {
  console.log(`could not read GeoNames capitals (${e?.message ?? e}); using the largest city everywhere`)
}
// Capitals the name match misses: Kuwait City is under 100,000 people in GeoNames (same point as the
// bundled demo city); GeoNames still lists Kazakhstan's capital under its former name.
const OVERRIDES = {
  Kuwait: { city: 'Kuwait City', lat: 29.3759, lon: 47.9774 },
  Kazakhstan: { city: 'Astana' },
}
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const chosen = new Map()
for (const [country, big] of largest) {
  const o = OVERRIDES[country]
  if (o?.lat !== undefined) {
    chosen.set(country, { country, city: o.city, lat: o.lat, lon: o.lon, capital: true })
    continue
  }
  const cap = o?.city ?? capitalOf.get(country)
  const hit = cap && cities.find(([name, ascii, c]) => c === country && (norm(name) === norm(cap) || norm(ascii) === norm(cap)))
  chosen.set(country, hit ? { country, city: hit[0], lat: hit[3], lon: hit[4], capital: true } : { ...big, capital: false })
}
let todo = [...chosen.values()]
if (only) todo = todo.filter((c) => only.has(c.country))

const done = new Map()
if (!refresh && existsSync(OUT)) for (const r of JSON.parse(readFileSync(OUT, 'utf-8')).countries) done.set(r.country, r)

function save() {
  const countries = [...done.values()].sort((a, b) => a.country.localeCompare(b.country))
  writeFileSync(OUT, JSON.stringify({ builtAt: new Date().toISOString().slice(0, 10), source: 'NASA POWER daily point API (MERRA-2); capital city per country from GeoNames (largest city where the capital has under 100,000 people)', countries }))
}

async function fetchJson(url) {
  let lastErr
  for (let i = 0; i < RETRIES; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(90000) })
      if (r.ok) return await r.json()
      lastErr = new Error(`HTTP ${r.status}`)
      if (r.status === 422) break // out of range for this point: retrying will not help
    } catch (e) {
      lastErr = e
    }
    await new Promise((res) => setTimeout(res, 3000 * (i + 1)))
  }
  throw lastErr
}

if (only) for (const c of only) done.delete(c) // --only always refetches the named countries
const queue = todo.filter((c) => !done.has(c.country))
console.log(`${todo.length} countries, ${queue.length} to fetch`)
const failed = []
let n = 0
async function worker() {
  for (;;) {
    const c = queue.shift()
    if (!c) return
    try {
      const daily = parsePower(await fetchJson(powerUrl(c.lat, c.lon)), c.lat, c.lon)
      // periods do not matter for trends; first and last ten years give the then/now averages
      const a = analyse(daily, { first: 1981, last: 1990 }, { first: 2016, last: 2025 })
      done.set(c.country, { country: c.country, city: c.city, capital: c.capital, lat: c.lat, lon: c.lon, ...summarise(a) })
      n++
      if (n % 5 === 0) save()
      console.log(`${String(done.size).padStart(3)}  ${c.country} (${c.city})`)
    } catch (e) {
      failed.push(c.country)
      console.log(`FAILED ${c.country} (${c.city}): ${e?.message ?? e}`)
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker))
save()
await server.close()
console.log(`done: ${done.size} countries in ${OUT}` + (failed.length ? `; failed: ${failed.join(', ')}` : ''))
