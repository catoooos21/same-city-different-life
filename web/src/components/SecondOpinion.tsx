import { useEffect, useMemo, useState } from 'react'
import { callOf, type Match } from '../casefile'
import { METRIC_BY_ID } from '../config/metrics'
import { fmtNum } from '../format'
import type { CityAnalysis, MetricResult } from '../metrics'
import { GPM_YEARS, agrees, loadRain, secondOpinion, type RainDaily, type RainRow } from '../rain'
import type { City } from '../state'
import { unitLong, valueDigits } from '../units'
import { changeWords } from './CaseFile'
import { TrendSentence, Verdict } from './Scrapbook'
import { Sparkline, YearChart } from './YearChart'

const SPAN = GPM_YEARS.last - GPM_YEARS.first + 1

/** "a", "a and b", "a, b and c". */
function listWords(xs: string[]): string {
  if (xs.length <= 1) return xs.join('')
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`
}

function matchWords(m: Match, direction: string): string {
  switch (m) {
    case 'same':
      return `Both agree: going ${direction}`
    case 'neither':
      return 'Both agree: no clear change'
    case 'opposite':
      return 'They disagree'
    case 'onlyA':
      return 'Only the satellite sees a change'
    case 'onlyB':
      return 'Only the model sees a change'
    default:
      return 'Not enough years'
  }
}

function Side({ r }: { r: MetricResult }) {
  const shown = fmtNum(r.then.mean, valueDigits(r.def))
  // "1 day a year", not "1 days a year"
  const unit = shown === '1' ? unitLong(r.def).replace(/^days/, 'day') : unitLong(r.def)
  return (
    <>
      <Sparkline r={r} first={GPM_YEARS.first} />
      <span className="typical">
        Typical year: <strong>{shown}</strong> {unit}
      </span>
      <span className="howmuch">{changeWords(r)}</span>
      <Verdict r={r} />
    </>
  )
}

/**
 * NASA's GPM satellite rain next to the model rain used on the rest of the page, for the same
 * point, the same UTC days, the same years and the same trend test.
 */
export function SecondOpinion({ city, a }: { city: City; a: CityAnalysis }) {
  const [rain, setRain] = useState<RainDaily | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [open, setOpen] = useState<string | null>(null)
  const key = `${city.lat.toFixed(4)},${city.lon.toFixed(4)}`

  useEffect(() => {
    setRain(null)
    setError(null)
    const ac = new AbortController()
    loadRain(city.lat, city.lon, ac.signal)
      .then((d) => {
        if (!ac.signal.aborted) setRain(d)
      })
      .catch((e) => {
        if (!ac.signal.aborted) setError(e.message ?? String(e))
      })
    return () => ac.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt])

  const rows = useMemo<RainRow[]>(() => (rain ? secondOpinion(rain) : []), [rain])
  const agreed = rows.filter((r) => agrees(r.match)).length
  const rainy = rows.find((r) => r.id === 'rainy_days')
  // measures the rest of the page stamps as a real change (model, all 45 years) that neither source shows over the satellite years
  const fades = rows.filter((r) => {
    const long = a.results[r.id] ? callOf(a.results[r.id]) : null
    return (long === 'up' || long === 'down') && r.match === 'neither'
  })
  // then/now shading means nothing here; YearChart still needs two periods
  const span = GPM_YEARS

  return (
    <section className="compare opinion">
      <h3>A second opinion on rain</h3>
      <p>
        Rain is the least certain thing on this page. So here is a second NASA source for the same spot: the <strong>GPM satellites</strong>, which measure rain from space, next to the{' '}
        <strong>weather model</strong> (MERRA-2) that the rest of the page uses.
      </p>
      <p className="muted small">
        Both are counted the same way over the same {SPAN} years, {GPM_YEARS.first}–{GPM_YEARS.last}: the years the satellites cover. The stamps elsewhere on this page use all 45 years, so they can differ from the ones here.
      </p>

      {error && (
        <div className="error">
          <p>
            Could not get the satellite rain for {city.name}: {error}
          </p>
          <button type="button" className="btn small" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </button>
        </div>
      )}
      {!rain && !error && (
        <div className="loading">
          <div className="spinner" />
          <p>Asking NASA for {SPAN} years of satellite rain…</p>
        </div>
      )}

      {rain && rows.length > 0 && (
        <>
          <p className="comparesum">
            <strong>Direction:</strong> the two sources agree on <strong>{agreed}</strong> of {rows.length} rain measures over these years.
            {rainy && rainy.satellite.then.mean !== null && rainy.model.then.mean !== null && (
              <>
                {' '}
                <strong>Amount:</strong> in a typical year the satellite counts <strong>{fmtNum(rainy.satellite.then.mean, 0)}</strong> rainy days in {city.name}, the model{' '}
                <strong>{fmtNum(rainy.model.then.mean, 0)}</strong>.
              </>
            )}
          </p>
          {fades.length > 0 && (
            <p className="fadenote">
              Over all 45 years the model shows a real change in {listWords(fades.map((r) => METRIC_BY_ID[r.id].name.toLowerCase()))}. Over these {SPAN} years neither source shows one. A shorter record
              makes a slow change harder to see, and the years before {GPM_YEARS.first} cannot be checked by satellite.
            </p>
          )}
          <div className="comparegrid">
            <div className="chead" />
            <div className="chead">GPM satellite</div>
            <div className="chead">Weather model</div>
            {rows.map((row) => {
              const def = METRIC_BY_ID[row.id]
              const isOpen = open === row.id
              const direction = row.satellite.trend?.direction === 'down' ? 'down' : 'up'
              const tag = agrees(row.match) ? 'same' : row.match === 'missing' ? 'missing' : 'opposite'
              return (
                <div className={`crow ${agrees(row.match) ? '' : 'opposite'} ${isOpen ? 'open' : ''}`} key={row.id}>
                  <button type="button" className="cwhat" onClick={() => setOpen(isOpen ? null : row.id)} aria-expanded={isOpen}>
                    <strong>{def.name}</strong>
                    <span className={`matchtag ${tag}`}>{matchWords(row.match, direction)}</span>
                  </button>
                  <div className="cside">
                    <Side r={row.satellite} />
                  </div>
                  <div className="cside">
                    <Side r={row.model} />
                  </div>
                  {isOpen && (
                    <div className="copen">
                      <div>
                        <h5>GPM satellite</h5>
                        <YearChart r={row.satellite} then={span} now={span} height={150} first={GPM_YEARS.first} bands={false} />
                        <TrendSentence r={row.satellite} />
                      </div>
                      <div>
                        <h5>Weather model</h5>
                        <YearChart r={row.model} then={span} now={span} height={150} first={GPM_YEARS.first} bands={false} />
                        <TrendSentence r={row.model} />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <p className="muted small">
            Why they can differ: the satellite sees a square about 10 km wide and the model one about 50 km wide, and each has its own weak spots. In dry places a satellite can count rain that
            evaporates before it reaches the ground. Days here run midnight to midnight in world time (UTC), because that is how NASA serves the satellite rain, so the model numbers differ a
            little from the rest of the page. Tap a row to see both charts.
          </p>
          <p className="muted small">
            Sources: GPM IMERG and MERRA-2 precipitation, both through <a href="https://power.larc.nasa.gov/docs/">NASA POWER</a>.
          </p>
        </>
      )}
    </section>
  )
}
