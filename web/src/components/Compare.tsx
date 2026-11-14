import { useEffect, useMemo, useState } from 'react'
import { compareCities, type ComparedMetric, type Match } from '../casefile'
import { METRIC_BY_ID, YEARS } from '../config/metrics'
import { analyse, type CityAnalysis, type MetricResult, type Period } from '../metrics'
import { DEMO_CITIES, loadDaily, type DailySeries } from '../power'
import type { City } from '../state'
import { changeWords } from './CaseFile'
import { CitySearch } from './CitySearch'
import { TrendSentence, Verdict } from './Scrapbook'
import { Sparkline, YearChart } from './YearChart'

const sameSpot = (a: City, b: { lat: number; lon: number }) => Math.abs(a.lat - b.lat) < 0.001 && Math.abs(a.lon - b.lon) < 0.001

function matchWords(m: Match, a: string, b: string): string {
  switch (m) {
    case 'same':
      return 'Same direction'
    case 'opposite':
      return 'Opposite directions'
    case 'onlyA':
      return `Only ${a} is changing`
    case 'onlyB':
      return `Only ${b} is changing`
    case 'neither':
      return 'No clear change in either'
    default:
      return 'Does not happen in both'
  }
}

function Side({ r }: { r: MetricResult | null }) {
  if (!r) return <span className="muted small">Hardly ever happens here</span>
  return (
    <>
      <Sparkline r={r} />
      <span className="howmuch">{changeWords(r)}</span>
      <Verdict r={r} />
    </>
  )
}

/**
 * The same metrics in a second city, side by side. The challenge text asks for exactly this:
 * one variable can trend one way in one region and the opposite way in another.
 */
export function Compare({ a, city, then, now, vs, onVs }: { a: CityAnalysis; city: City; then: Period; now: Period; vs: City | null; onVs: (c: City | null) => void }) {
  const [daily, setDaily] = useState<DailySeries | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const other = vs && !sameSpot(city, vs) ? vs : null
  const key = other ? `${other.lat.toFixed(4)},${other.lon.toFixed(4)}` : ''

  useEffect(() => {
    setDaily(null)
    setError(null)
    if (!other) return
    const ac = new AbortController()
    loadDaily(other.lat, other.lon, undefined, ac.signal)
      .then((d) => {
        if (!ac.signal.aborted) setDaily(d)
      })
      .catch((e) => {
        if (!ac.signal.aborted) setError(e.message ?? String(e))
      })
    return () => ac.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const b = useMemo<CityAnalysis | null>(() => (daily ? analyse(daily, then, now) : null), [daily, then.first, then.last, now.first, now.last])
  const rows = useMemo<ComparedMetric[]>(() => (b ? compareCities(a, b) : []), [a, b])
  const count = (m: Match) => rows.filter((r) => r.match === m).length
  const demos = DEMO_CITIES.filter((d) => !sameSpot(city, d))

  return (
    <section className="compare">
      <h3>Same question, another city</h3>
      <p>The same weather measure can go one way in one place and the other way somewhere else. Put a second city next to {city.name} and see.</p>
      <div className="comparepick">
        <label className="field grow">
          <span>Compare with</span>
          <CitySearch key={key || 'none'} value={other} onChange={onVs} />
        </label>
        <p className="demos">
          {demos.map((d) => (
            <button key={d.id} type="button" className={`chip ${other && sameSpot(other, d) ? 'on' : ''}`} onClick={() => onVs({ name: d.name, country: d.country, lat: d.lat, lon: d.lon })}>
              {d.name}
            </button>
          ))}
          {other && (
            <button type="button" className="linkish" onClick={() => onVs(null)}>
              clear
            </button>
          )}
        </p>
      </div>

      {error && <p className="error">Could not get the data for {other?.name}: {error}</p>}
      {other && !b && !error && (
        <div className="loading">
          <div className="spinner" />
          <p>Getting {other.name} from NASA…</p>
        </div>
      )}

      {other && b && (
        <>
          <p className="comparesum">
            Out of {rows.length} measures: <strong>{count('opposite')}</strong> in opposite directions, <strong>{count('same')}</strong> in the same direction, <strong>{count('onlyA') + count('onlyB')}</strong> changing in only one of the two
            cities.
          </p>
          <div className="comparegrid">
            <div className="chead" />
            <div className="chead">{city.name}</div>
            <div className="chead">{other.name}</div>
            {rows.map((row) => {
              const def = METRIC_BY_ID[row.id]
              const isOpen = open === row.id
              return (
                <div className={`crow ${row.match} ${isOpen ? 'open' : ''} ${def.basic ? 'basic' : ''}`} key={row.id}>
                  <button type="button" className="cwhat" onClick={() => setOpen(isOpen ? null : row.id)} aria-expanded={isOpen}>
                    <strong>{def.name}</strong>
                    {def.basic && <span className="basictag">basics</span>}
                    <span className={`matchtag ${row.match}`}>{matchWords(row.match, city.name, other.name)}</span>
                  </button>
                  <div className="cside">
                    <Side r={row.a} />
                  </div>
                  <div className="cside">
                    <Side r={row.b} />
                  </div>
                  {isOpen && (
                    <div className="copen">
                      {row.a && (
                        <div>
                          <h5>{city.name}</h5>
                          <YearChart r={row.a} then={then} now={now} height={150} />
                          <TrendSentence r={row.a} />
                        </div>
                      )}
                      {row.b && (
                        <div>
                          <h5>{other.name}</h5>
                          <YearChart r={row.b} then={then} now={now} height={150} />
                          <TrendSentence r={row.b} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <p className="muted small">
            “Hot” is measured against each city’s own {YEARS.first}–2010 weather, so a hot day in {city.name} and a hot day in {other.name} are different temperatures. Compare the directions, not the counts. Tap a row to see both
            charts. The basics at the top are plain °C and mm, so those you can compare directly.
          </p>
        </>
      )}
    </section>
  )
}
