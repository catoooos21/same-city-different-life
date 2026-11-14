import { useEffect, useMemo, useState } from 'react'
import { callOf } from '../casefile'
import { YEARS } from '../config/metrics'
import { fmtNum, fmtP, fmtSigned } from '../format'
import { groundStory, loadLand, type LandDaily, type LandRow } from '../land'
import type { CityAnalysis, MetricResult } from '../metrics'
import type { City } from '../state'
import { unitShort } from '../units'
import { Verdict } from './Scrapbook'
import { Sparkline, YearChart } from './YearChart'
import './land.css'

const SPAN = YEARS.last - YEARS.first + 1

/** Decimals for a change per ten years: temperature and soil wetness move in small steps. */
function rateDigits(r: MetricResult, n: number): number {
  if (r.def.unit === '°C') return 2
  if (isPercent(r)) return Math.abs(n) < 1 ? 2 : 1
  return Math.abs(n) < 2 ? 1 : 0
}

const isPercent = (r: MetricResult) => (r.def.unit as string) === '%'

/** Unit of a change. Soil wetness is itself a percentage, so its change is in points: 23 % to 18 % is 5 points. */
function rateUnit(r: MetricResult, n?: number): string {
  if (isPercent(r)) return n === 1 ? 'point' : 'points'
  return unitShort(r.def, n)
}

/** "Up about 0.41 °C every ten years", or "No steady direction" when the test finds no trend. */
export function landChange(r: MetricResult): string {
  const call = callOf(r)
  if (call === 'none' || call === null) return 'No steady direction'
  const n = Math.abs(r.slopePerDecade!)
  const shown = n.toFixed(rateDigits(r, n))
  return `${call === 'up' ? 'Up' : 'Down'} about ${shown} ${rateUnit(r, +shown)} every ten years`
}

/** The same thing inside a sentence: "going up about 0.41 °C every ten years". */
function trendPhrase(r: MetricResult): string {
  const call = callOf(r)
  if (call === 'none' || call === null) return 'showing no steady direction'
  const n = Math.abs(r.slopePerDecade!)
  const shown = n.toFixed(rateDigits(r, n))
  return `going ${call} about ${shown} ${rateUnit(r, +shown)} every ten years`
}

function TrendLine({ r }: { r: MetricResult }) {
  const t = r.trend
  if (!t) return <p className="muted">Fewer than ten complete years, so no trend test was run.</p>
  const s = r.slopePerDecade!
  const [lo, hi] = r.ciPerDecade!
  const dp = rateDigits(r, Math.abs(s))
  const unit = rateUnit(r)
  return (
    <p className="trendsentence">
      {t.significant ? (
        <>
          <strong>Real change.</strong> Going {s > 0 ? 'up' : 'down'} by about {Math.abs(s).toFixed(dp)} {unit} every ten years (somewhere between {fmtSigned(lo, dp)} and {fmtSigned(hi, dp)}).
        </>
      ) : (
        <>
          <strong>No clear change.</strong> The best guess is {fmtSigned(s, dp)} {unit} every ten years, but it could be anywhere between {fmtSigned(lo, dp)} and {fmtSigned(hi, dp)}, so no steady
          direction.
        </>
      )}{' '}
      <small className="muted">
        Trend test: {fmtP(t.p)}, {t.n} years. The dots are each year; the line is the long-term trend.
      </small>
    </p>
  )
}

/**
 * The land under the city, next to the air above it: ground temperature, soil wetness and
 * evaporation from the same NASA model, the same point, the same years and the same trend test.
 */
export function Land({ city, a }: { city: City; a: CityAnalysis }) {
  const [land, setLand] = useState<LandDaily | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [open, setOpen] = useState<string | null>(null)
  const key = `${city.lat.toFixed(4)},${city.lon.toFixed(4)}`

  useEffect(() => {
    setLand(null)
    setError(null)
    const ac = new AbortController()
    loadLand(city.lat, city.lon, ac.signal)
      .then((d) => {
        if (!ac.signal.aborted) setLand(d)
      })
      .catch((e) => {
        if (!ac.signal.aborted) setError(e.message ?? String(e))
      })
    return () => ac.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt])

  const rows = useMemo<LandRow[]>(() => (land ? groundStory(land, a.then, a.now) : []), [land, a.then.first, a.then.last, a.now.first, a.now.last])
  const real = rows.filter((r) => r.result.trend?.significant).length
  const ground = rows.find((r) => r.result.def.id === 'ground_temp')?.result
  const air = a.results.mean_temp

  return (
    <section className="casefile land">
      <h3>The ground under {city.name}</h3>
      <p>
        The rest of this page is about the air. This is the <strong>land</strong> under it: how hot the ground gets, how wet the soil is, and how much water it gives back to the air.
      </p>
      <p className="muted small">
        Same NASA model (MERRA-2), same spot, same {SPAN} years ({YEARS.first}–{YEARS.last}) and the same trend test as everything above.
      </p>

      {error && (
        <div className="error">
          <p>
            Could not get the land data for {city.name}: {error}
          </p>
          <button type="button" className="btn small" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </button>
        </div>
      )}
      {!land && !error && (
        <div className="loading">
          <div className="spinner" />
          <p>Asking NASA for {SPAN} years of the ground…</p>
        </div>
      )}

      {land && rows.length > 0 && (
        <>
          <p className="landsum">
            <strong>{real}</strong> of {rows.length} land measures {real === 1 ? 'shows' : 'show'} a real change.
            {ground && air && ground.trend && air.trend && (
              <>
                {' '}
                <strong>Air and ground:</strong> the air here is {trendPhrase(air)}; the ground is {trendPhrase(ground)}.
              </>
            )}
          </p>
          <div className="casegroup">
            <ol className="caselist">
              {rows.map(({ measure, result: r }) => {
                const isOpen = open === r.def.id
                return (
                  <li className={isOpen ? 'open' : ''} key={r.def.id}>
                    <button type="button" className="caserow" onClick={() => setOpen(isOpen ? null : r.def.id)} aria-expanded={isOpen}>
                      <span className="what">
                        <strong>{r.def.name}</strong>
                        {r.def.plain && <small>{r.def.plain}</small>}
                      </span>
                      <Sparkline r={r} />
                      <span className="howmuch">
                        {landChange(r)}
                        {r.then.mean !== null && r.now.mean !== null && (
                          <small>
                            {fmtNum(r.then.mean, measure.digits)} then, {fmtNum(r.now.mean, measure.digits)} {unitShort(r.def)} now
                          </small>
                        )}
                      </span>
                      <Verdict r={r} />
                    </button>
                    {isOpen && (
                      <div className="caseopen">
                        <YearChart r={r} then={a.then} now={a.now} />
                        <TrendLine r={r} />
                        <p className="muted small landdef">{r.def.definition}</p>
                      </div>
                    )}
                  </li>
                )
              })}
            </ol>
          </div>
          <p className="fadenote">
            Nobody measures the soil under every city. These numbers are the weather model’s own picture of the ground, built from its rain and heat, for a square about 50 km wide that is mostly
            not city. The model does not know about irrigation, pavement or buildings. Read a “real change” here as a clue to follow up, not as a measurement.
          </p>
          <p className="hint">Tap any row to see every year since {YEARS.first}.</p>
          <p className="muted small">
            Source: MERRA-2 land surface (skin temperature, surface soil wetness, land evaporation) through <a href="https://power.larc.nasa.gov/docs/">NASA POWER</a>.
          </p>
        </>
      )}
    </section>
  )
}
