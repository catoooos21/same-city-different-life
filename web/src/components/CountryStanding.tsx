import { useEffect, useMemo, useState } from 'react'
import { ACTIONS, STAGE_LABEL, STAGE_RULE } from '../config/actions'
import { METRIC_BY_ID, YEARS } from '../config/metrics'
import { MORE_IS_BETTER, MORE_IS_WORSE, WEATHER_LABEL, WORLD_PER_DECADE, countWeather, summarise, weatherOf, type CountryRow, type CountrySummary } from '../countries'
import type { CityAnalysis } from '../metrics'
import type { City } from '../state'
import { fmtSigned } from '../format'
import './countrystanding.css'

/** Names of the everyday-life metrics that are really getting better / worse at this city. */
function lifeNames(s: CountrySummary): { worse: string[]; better: string[] } {
  const worse: string[] = []
  const better: string[] = []
  for (const m of s.metrics) {
    if (m.call === 'none') continue
    const up = m.call === 'up'
    const name = METRIC_BY_ID[m.id]?.name.toLowerCase() ?? m.id
    const label = `${up ? 'more' : 'fewer'} ${name}`
    if (MORE_IS_WORSE.includes(m.id)) (up ? worse : better).push(label)
    else if (MORE_IS_BETTER.includes(m.id)) (up ? better : worse).push(label)
  }
  return { worse, better }
}

/** One line of scale from the prebuilt capitals file; quietly absent if the file cannot be read. */
function useWorldLine(open: boolean): string | null {
  const [line, setLine] = useState<string | null>(null)
  useEffect(() => {
    if (!open || line) return
    let alive = true
    fetch(`${import.meta.env.BASE_URL}countries.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { countries: CountryRow[] }) => {
        if (!alive) return
        const c = countWeather(j.countries)
        setLine(
          `For scale, we ran the same test on the capital of ${j.countries.length} countries: ${c.fast} are heating faster than the world, ${c.heating} are heating, ${c.none} show no clear change and ${c.cooling} ${c.cooling === 1 ? 'is' : 'are'} cooling.`,
        )
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [open, line])
  return line
}

/**
 * Shown after a city search: where this place stands. Two stamps that are never mixed:
 * the weather at the searched city (NASA data) and what its country is doing (team context).
 */
export function CountryStanding({ a, city }: { a: CityAnalysis; city: City }) {
  const s = useMemo(() => summarise(a), [a])
  const w = weatherOf(s)
  const life = lifeNames(s)
  const action = city.country ? ACTIONS[city.country] : undefined
  const [open, setOpen] = useState(false)
  const worldLine = useWorldLine(open)

  return (
    <section className="standing">
      <div className="standing-row">
        <div className="standing-side">
          <p className="sidelabel">
            The weather in {city.name} <small>NASA data</small>
          </p>
          <span className={`wstamp ${w}`}>{WEATHER_LABEL[w]}</span>
          {s.temp && <p>{fmtSigned(s.temp.perDecade, 2)} °C every ten years since {YEARS.first}.</p>}
        </div>
        {city.country && (
          <div className="standing-side">
            <p className="sidelabel">
              {city.country}: what the country is doing <small>context</small>
            </p>
            <span className={`astamp ${action ? action.stage : 'unknown'}`}>{action ? STAGE_LABEL[action.stage] : 'Not looked into yet'}</span>
            <p>{action ? action.target : 'We have not written an action note for this country yet.'}</p>
          </div>
        )}
      </div>

      <details className="standing-more" onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
        <summary>What do these stamps mean?</summary>
        <div className="standing-cols">
          <div>
            <h4>The weather stamp</h4>
            <p>
              It comes from the yearly average temperature in {city.name}, {YEARS.first} to {YEARS.last}, with the same trend test as the rest of the page. “Heating faster than the world” means at least 1.5 times the world’s{' '}
              {fmtSigned(WORLD_PER_DECADE, 2)} °C every ten years (NASA GISTEMP).
            </p>
            {life.worse.length > 0 && (
              <p className="worse">
                <strong>Getting worse here:</strong> {life.worse.join(', ')}.
              </p>
            )}
            {life.better.length > 0 && (
              <p className="better">
                <strong>Getting better here:</strong> {life.better.join(', ')}.
              </p>
            )}
            {action?.dataNote && (w === 'cooling' || w === 'none') && <p className="datanote">{action.dataNote}</p>}
            {worldLine && <p className="muted">{worldLine}</p>}
          </div>
          {city.country && (
            <div>
              <h4>The action stamp</h4>
              <p>One yardstick for every country, so it is not our opinion: when did it first set a national net-zero target?</p>
              {action ? (
                <>
                  <p>
                    <strong>{STAGE_LABEL[action.stage]}:</strong> {STAGE_RULE[action.stage]}
                  </p>
                  {action.steps.length > 0 && (
                    <ul>
                      {action.steps.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  )}
                  <p className="csources">
                    Sources:{' '}
                    {action.sources.map((src, i) => (
                      <span key={src.url}>
                        {i > 0 && ', '}
                        <a href={src.url} target="_blank" rel="noreferrer">
                          {src.label}
                        </a>
                      </span>
                    ))}
                  </p>
                </>
              ) : (
                <p className="muted">Action notes cover {Object.keys(ACTIONS).length} countries so far. They are written by the team from public sources.</p>
              )}
            </div>
          )}
        </div>
        <p className="standing-note">
          <strong>Two different things, side by side.</strong> No country can cool its own weather with its own rules: the air is shared, and the warming follows what the whole world burns. A country that acts is cutting its share of the cause. That shows up first in its emissions and in how it protects people from heat, and in the thermometer only when the world acts together.
        </p>
      </details>
    </section>
  )
}
