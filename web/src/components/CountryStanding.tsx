import { useEffect, useState } from 'react'
import { ACTIONS, GENERIC_DOING, GENERIC_WHY } from '../config/actions'
import { LEVEL_BAND_PCT, STANDING_LABEL, WINDOW_YEARS, countryVerdict, verdictSentence, type EmissionsFile } from '../emissions'
import type { City } from '../state'
import './countrystanding.css'

const CHART_FROM = 2000

let cache: Promise<EmissionsFile> | null = null
function loadEmissions(): Promise<EmissionsFile> {
  if (!cache) {
    cache = fetch(`${import.meta.env.BASE_URL}emissions.json`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    cache.catch(() => (cache = null))
  }
  return cache
}

/** The country's CO2 since 1990 as a small line, with the ten judged years drawn heavier. */
function Co2Spark({ years, values, from }: { years: number[]; values: (number | null)[]; from: number }) {
  const W = 220
  const H = 46
  const pad = 4
  const finite = values.filter((v): v is number => v !== null)
  if (finite.length < 2) return null
  const hi = Math.max(...finite) * 1.05
  const x = (y: number) => pad + ((y - years[0]) / (years[years.length - 1] - years[0])) * (W - 2 * pad)
  const yv = (v: number) => pad + (1 - v / hi) * (H - 2 * pad)
  const pts = (keep: (y: number) => boolean) =>
    years
      .map((yr, i) => (values[i] === null || !keep(yr) ? null : `${x(yr).toFixed(1)},${yv(values[i] as number).toFixed(1)}`))
      .filter(Boolean)
      .join(' ')
  return (
    <svg className="co2spark" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`CO2 emissions, ${years[0]} to ${years[years.length - 1]}`} preserveAspectRatio="none">
      <line x1={pad} x2={W - pad} y1={H - pad} y2={H - pad} className="base" />
      <polyline points={pts(() => true)} className="all" />
      <polyline points={pts((y) => y >= from)} className="recent" />
    </svg>
  )
}

/**
 * Shown after a city search: is this country improving, starting, or getting worse, and why.
 * Judged on the country's own CO2 pollution, not on the weather shown on the rest of the page.
 */
export function CountryStanding({ city }: { city: City }) {
  const [file, setFile] = useState<EmissionsFile | null>(null)
  useEffect(() => {
    let alive = true
    loadEmissions()
      .then((f) => alive && setFile(f))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  if (!city.country || !file) return null
  const action = ACTIONS[city.country]
  const v = countryVerdict(file, city.country, action?.stage)
  if (!v) return null

  // The chart starts in 2000: Kuwait's 1991 oil-fire year is several times any other and flattens the line.
  const i0 = Math.max(0, file.years.indexOf(CHART_FROM))
  const chartYears = file.years.slice(i0)
  const chartValues = file.countries[city.country].slice(i0)

  const notFalling = v.standing !== 'improving'
  // A country with no net-zero target leads with what it has built; the missing target comes last.
  const doing = action ? (action.stage === 'none' ? [...action.doing, action.target] : [action.target, ...action.doing]) : v.standing === 'improving' ? [GENERIC_DOING] : []
  const countryName = /^United /.test(city.country) ? `the ${city.country}` : city.country
  const why = notFalling ? (action ? action.why : v.call === 'rising' ? [GENERIC_WHY] : []) : []
  const doingTitle = v.standing === 'improving' || action?.stage === 'none' ? (v.standing === 'worse' ? 'What it has promised' : 'What it is doing') : v.standing === 'starting' ? 'What it has started' : 'What it has promised'
  const whyTitle = v.call === 'rising' ? 'Why its pollution is still climbing' : 'Why it is not falling yet'

  return (
    <section className={`standing ${v.standing}`}>
      <div className="standing-head">
        <div>
          <p className="sidelabel">Where {countryName} stands</p>
          <span className={`sstamp ${v.standing}`}>{STANDING_LABEL[v.standing]}</span>
          <p className="standing-line">{verdictSentence(v)}</p>
        </div>
        <figure>
          <Co2Spark years={chartYears} values={chartValues} from={v.from} />
          <figcaption>
            Its CO₂ each year, {chartYears[0]}–{v.to}. Darker: the {WINDOW_YEARS} years we judged.
          </figcaption>
        </figure>
      </div>

      {(doing.length > 0 || why.length > 0) && (
        <div className="standing-lists">
          {doing.length > 0 && (
            <div>
              <h4>{doingTitle}</h4>
              <ul>
                {doing.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          )}
          {why.length > 0 && (
            <div>
              <h4>{whyTitle}</h4>
              <ul>
                {why.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {!action && notFalling && v.call !== 'rising' && <p className="standing-plain">We have not written up what this country is doing yet.</p>}

      <details className="standing-more">
        <summary>How we decide</summary>
        <p>
          We judge a country on its own CO₂ pollution from burning oil, gas and coal, because that is what its rules can change. The weather on this page follows what the whole world burns, so it cannot tell you whether one country is doing well.
        </p>
        <ul>
          <li>
            <strong>Improving:</strong> its CO₂ fell steadily over the last {WINDOW_YEARS} years ({v.from}–{v.to}), by the same trend test as the rest of the page.
          </li>
          <li>
            <strong>Starting:</strong> not falling yet, but either its CO₂ has stopped climbing (no steady trend, and less than {LEVEL_BAND_PCT} % above {WINDOW_YEARS} years ago), or it set its first national net-zero target in 2020 or later.
          </li>
          <li>
            <strong>Getting worse:</strong> its CO₂ is still climbing, with no recent start that we know of.
          </li>
        </ul>
        <p className="csources">
          CO₂ data:{' '}
          <a href={file.url} target="_blank" rel="noreferrer">
            Global Carbon Budget, via Our World in Data
          </a>{' '}
          (not NASA). The notes on what a country is doing are written by the team for {Object.keys(ACTIONS).length} countries so far.
          {action && (
            <>
              {' '}
              Sources for {city.country}:{' '}
              {action.sources.map((src, i) => (
                <span key={src.url}>
                  {i > 0 && ', '}
                  <a href={src.url} target="_blank" rel="noreferrer">
                    {src.label}
                  </a>
                </span>
              ))}
              .
            </>
          )}
        </p>
      </details>
    </section>
  )
}
