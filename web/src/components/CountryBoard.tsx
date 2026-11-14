import { useEffect, useMemo, useState } from 'react'
import { ACTIONS, STAGE_LABEL, STAGE_RULE, type ActionStage } from '../config/actions'
import { METRIC_BY_ID, YEARS } from '../config/metrics'
import { MORE_IS_BETTER, MORE_IS_WORSE, WEATHER_LABEL, WORLD_PER_DECADE, countWeather, lifeScore, weatherOf, type CountryRow, type Weather } from '../countries'
import type { City } from '../state'
import { fmtSigned } from '../format'
import './countryboard.css'

interface BoardFile {
  builtAt: string
  source: string
  countries: CountryRow[]
}

const STAGES: ActionStage[] = ['long', 'recent', 'none']
const WEATHERS: Weather[] = ['fast', 'heating', 'none', 'cooling']

function WeatherStamp({ w }: { w: Weather }) {
  return <span className={`wstamp ${w}`}>{WEATHER_LABEL[w]}</span>
}

/** Names of the everyday-life metrics that are really getting better / worse at this city. */
function lifeNames(r: CountryRow): { worse: string[]; better: string[] } {
  const worse: string[] = []
  const better: string[] = []
  for (const m of r.metrics) {
    if (m.call === 'none') continue
    const up = m.call === 'up'
    const name = METRIC_BY_ID[m.id]?.name.toLowerCase() ?? m.id
    const label = `${up ? 'more' : 'fewer'} ${name}`
    if (MORE_IS_WORSE.includes(m.id)) (up ? worse : better).push(label)
    else if (MORE_IS_BETTER.includes(m.id)) (up ? better : worse).push(label)
  }
  return { worse, better }
}

function hotDaysLine(r: CountryRow): string | null {
  const { then, now } = r.hotDays
  if (then === null || now === null) return null
  return `Hot days a year: ${Math.round(then)} in the 1980s, ${Math.round(now)} now.`
}

function toCity(r: CountryRow): City {
  return { name: r.city, country: r.country, lat: r.lat, lon: r.lon }
}

export function CountryBoard({ onPick }: { onPick: (c: City) => void }) {
  const [file, setFile] = useState<BoardFile | null>(null)
  const [failed, setFailed] = useState(false)
  const [filter, setFilter] = useState<Weather | 'better' | 'all'>('all')
  const [text, setText] = useState('')

  useEffect(() => {
    let alive = true
    fetch(`${import.meta.env.BASE_URL}countries.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: BoardFile) => alive && setFile(j))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [])

  const rows = file?.countries ?? []
  const counts = useMemo(() => countWeather(rows), [rows])
  const betterCount = useMemo(() => rows.filter((r) => lifeScore(r).better > 0).length, [rows])
  const featured = useMemo(() => rows.filter((r) => ACTIONS[r.country]), [rows])
  const shown = useMemo(() => {
    const t = text.trim().toLowerCase()
    return rows
      .filter((r) => (filter === 'all' ? true : filter === 'better' ? lifeScore(r).better > 0 : weatherOf(r) === filter))
      .filter((r) => !t || r.country.toLowerCase().includes(t) || r.city.toLowerCase().includes(t))
      .sort((a, b) => (b.temp?.perDecade ?? -9) - (a.temp?.perDecade ?? -9))
  }, [rows, filter, text])

  if (failed) return null
  if (!file) return <p className="muted small">Loading the country board…</p>

  return (
    <section className="board">
      <h2>The country board</h2>
      <p className="board-lead">
        Who is heating, and who is doing something about it? We measured <strong>{rows.length} countries</strong> at their capital city, {YEARS.first} to {YEARS.last}.{' '}
        <strong>{counts.fast}</strong> are heating faster than the world, <strong>{counts.heating}</strong> are heating, <strong>{counts.none}</strong> show no clear change and{' '}
        <strong>{counts.cooling}</strong> {counts.cooling === 1 ? 'is' : 'are'} cooling.
      </p>
      <div className="board-note">
        <p>
          <strong>Two different things, side by side.</strong> The <em>weather</em> stamp is NASA data. The <em>action</em> stamp is what the country has pledged or passed.
        </p>
        <p>
          No country can cool its own weather with its own rules: the air is shared, and the warming follows what the whole world burns. A country that acts is cutting its share of the cause. That shows up first in its emissions and in how it protects people from heat, and in the thermometer only when the world acts together.
        </p>
      </div>

      {STAGES.map((stage) => {
        const group = featured.filter((r) => ACTIONS[r.country].stage === stage).sort((a, b) => a.country.localeCompare(b.country))
        if (!group.length) return null
        return (
          <div key={stage} className={`stage ${stage}`}>
            <h3>
              {STAGE_LABEL[stage]} <small>{STAGE_RULE[stage]}</small>
            </h3>
            <div className="ccards">
              {group.map((r) => (
                <CountryCard key={r.country} r={r} onPick={onPick} />
              ))}
            </div>
          </div>
        )
      })}
      <p className="muted small">
        Action notes cover {featured.length} countries so far and were written by the team from public sources (listed on each card). They are context, not NASA data, and not the cause of the weather next to them.
      </p>

      <div className="allcountries">
        <h3>Every country, by the data</h3>
        <div className="board-filters">
          <button type="button" className={`chip ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>
            All {rows.length}
          </button>
          {WEATHERS.map((w) => (
            <button key={w} type="button" className={`chip ${filter === w ? 'on' : ''}`} onClick={() => setFilter(w)}>
              {WEATHER_LABEL[w]} {counts[w]}
            </button>
          ))}
          <button type="button" className={`chip ${filter === 'better' ? 'on' : ''}`} onClick={() => setFilter('better')}>
            Something getting better {betterCount}
          </button>
          <input type="search" placeholder="Find a country…" value={text} onChange={(e) => setText(e.target.value)} aria-label="Find a country" />
        </div>
        <ol className="crows">
          {shown.map((r) => {
            const life = lifeScore(r)
            const a = ACTIONS[r.country]
            return (
              <li key={r.country}>
                <button type="button" className="crow" onClick={() => onPick(toCity(r))} title={`Open ${r.city}`}>
                  <span className="cname">
                    <strong>{r.country}</strong>
                    <small>{r.city}</small>
                  </span>
                  <WeatherStamp w={weatherOf(r)} />
                  <span className="cnum">{r.temp ? `${fmtSigned(r.temp.perDecade, 2)} °C / 10 yrs` : '–'}</span>
                  <span className="clife">
                    {life.worse} worse, {life.better} better
                  </span>
                  <span className={`astamp ${a ? a.stage : 'unknown'}`}>{a ? STAGE_LABEL[a.stage] : 'Not looked into yet'}</span>
                </button>
              </li>
            )
          })}
        </ol>
        {!shown.length && <p className="muted">No country matches.</p>}
        <p className="muted small">
          Heating faster than the world means at least 1.5 times the world’s {fmtSigned(WORLD_PER_DECADE, 2)} °C every ten years (NASA GISTEMP). “Worse” and “better” count the everyday heat and comfort measures that pass the trend test. One city stands for the whole country, so read each row as “the capital of”. A capital that is flat or cooling is not proof that a policy worked: local haze, irrigation, the sea and the weather model itself can all hide or mimic a trend. Tap a row to open that city.
        </p>
      </div>
    </section>
  )
}

function CountryCard({ r, onPick }: { r: CountryRow; onPick: (c: City) => void }) {
  const a = ACTIONS[r.country]
  const w = weatherOf(r)
  const life = lifeNames(r)
  const hot = hotDaysLine(r)
  return (
    <article className="ccard">
      <header>
        <h4>{r.country}</h4>
        <small>
          measured at {r.city}
          {r.capital ? '' : ' (largest city)'}
        </small>
      </header>
      <div className="side weather">
        <p className="sidelabel">The weather (NASA data)</p>
        <WeatherStamp w={w} />
        <p>
          {r.temp && (
            <>
              {fmtSigned(r.temp.perDecade, 2)} °C every ten years.{' '}
            </>
          )}
          {hot}
        </p>
        {a.dataNote && <p className="datanote">{a.dataNote}</p>}
        {life.worse.length > 0 && (
          <p className="worse">
            <strong>Getting worse:</strong> {life.worse.join(', ')}.
          </p>
        )}
        {life.better.length > 0 && (
          <p className="better">
            <strong>Getting better:</strong> {life.better.join(', ')}.
          </p>
        )}
      </div>
      <div className="side action">
        <p className="sidelabel">What the country is doing (context)</p>
        <span className={`astamp ${a.stage}`}>{STAGE_LABEL[a.stage]}</span>
        <p>{a.target}</p>
        {a.steps.length > 0 && (
          <ul>
            {a.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        )}
        <p className="csources">
          Sources:{' '}
          {a.sources.map((s, i) => (
            <span key={s.url}>
              {i > 0 && ', '}
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.label}
              </a>
            </span>
          ))}
        </p>
      </div>
      <button type="button" className="btn small" onClick={() => onPick(toCity(r))}>
        Open {r.city}
      </button>
    </article>
  )
}
