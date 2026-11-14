import { useEffect, useMemo, useRef, useState } from 'react'
import { BIRTH_YEARS, YEARS } from './config/metrics'
import { LENSES, LENS_BY_ID, type Lens } from './config/lenses'
import { analyse, type CityAnalysis } from './metrics'
import { DEMO_CITIES, loadDaily, type DailySeries, type LoadStatus } from './power'
import { DEFAULT_QUERY, parseHash, periods, toHash, type City, type Query } from './state'
import { CaseFile } from './components/CaseFile'
import { Compare } from './components/Compare'
import { CountryBoard } from './components/CountryBoard'
import { FutureBook } from './components/Future'
import { CitySearch } from './components/CitySearch'
import { Scrapbook, periodLabel, type PageLabels } from './components/Scrapbook'
import { GlobalContext, Methods } from './components/Methods'
import { WhyPanel } from './components/Context'

const years = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i)

export default function App() {
  const [q, setQ] = useState<Query>(() => parseHash(location.hash))
  const [daily, setDaily] = useState<DailySeries | null>(null)
  const [status, setStatus] = useState<LoadStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abort = useRef<AbortController | null>(null)

  // URL <-> state
  useEffect(() => {
    const h = toHash(q)
    if (location.hash !== h) history.replaceState(null, '', h)
  }, [q])
  useEffect(() => {
    const on = () => setQ(parseHash(location.hash))
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  // load data when the city changes
  const cityKey = q.city ? `${q.city.lat.toFixed(4)},${q.city.lon.toFixed(4)}` : ''
  useEffect(() => {
    if (!q.city) {
      setDaily(null)
      return
    }
    abort.current?.abort()
    const ac = new AbortController()
    abort.current = ac
    setDaily(null)
    setError(null)
    loadDaily(q.city.lat, q.city.lon, setStatus, ac.signal)
      .then((d) => {
        if (!ac.signal.aborted) (setDaily(d), setStatus({ stage: 'done', message: '' }))
      })
      .catch((e) => {
        if (!ac.signal.aborted) setError(e.message ?? String(e))
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityKey])

  const { then, now } = periods(q)
  const analysis = useMemo<CityAnalysis | null>(() => (daily ? analyse(daily, then, now) : null), [daily, then.first, then.last, now.first, now.last])

  const lens = LENS_BY_ID[q.lens]
  const set = (patch: Partial<Query>) => setQ((old) => ({ ...old, ...patch }))

  return (
    <div className="app">
      <header className="masthead">
        <h1 onClick={() => set({ city: null })} role="link" tabIndex={0}>
          Same City, Different Life
        </h1>
        <p className="tagline">Two lives in the same city, years apart. Told by NASA weather data.</p>
      </header>

      {!q.city ? <Home q={q} set={set} /> : <Result q={q} set={set} daily={daily} analysis={analysis} status={status} error={error} lens={lens} then={then} now={now} />}

      <footer>
        <p>NASA Space Apps Challenge 2026. Weather: NASA POWER (MERRA-2). World temperature: NASA GISTEMP. Cities: GeoNames (CC BY 4.0).</p>
      </footer>
    </div>
  )
}

function Home({ q, set }: { q: Query; set: (p: Partial<Query>) => void }) {
  const [pending, setPending] = useState<City | null>(null)
  const go = (c: City | null) => c && set({ city: c })
  return (
    <section className="home">
      <div className="hero">
        <h2>Two childhoods</h2>
        <p className="story">
          One kid born in <strong>{q.b1}</strong>. One born in <strong>{q.b2}</strong>. Same city.
          <br />
          <em>Same city. Same age. A different childhood.</em>
        </p>
      </div>
      <form
        className="picker"
        onSubmit={(e) => {
          e.preventDefault()
          go(pending)
        }}
      >
        <label className="field grow">
          <span>Pick a city</span>
          <CitySearch value={pending} onChange={setPending} autoFocus />
        </label>
        <div className="field">
          <span>Born in</span>
          <div className="pair">
            <select value={q.b1} onChange={(e) => set({ b1: +e.target.value })} aria-label="First birth year">
              {years(BIRTH_YEARS.first, BIRTH_YEARS.last).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <span className="vs">vs</span>
            <select value={q.b2} onChange={(e) => set({ b2: +e.target.value })} aria-label="Second birth year">
              {years(BIRTH_YEARS.first, BIRTH_YEARS.last).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <span>Who are you?</span>
          <LensPicker value={q.lens} onChange={(lens) => set({ lens })} />
        </div>
        <button type="submit" className="btn primary" disabled={!pending}>
          Open the scrapbooks
        </button>
      </form>
      <p className="demos">
        Try a demo city:{' '}
        {DEMO_CITIES.map((c) => (
          <button key={c.id} type="button" className="chip" onClick={() => go({ name: c.name, country: c.country, lat: c.lat, lon: c.lon })}>
            {c.name}
          </button>
        ))}
      </p>
      <p className="muted small">Any city on Earth works. The weather comes straight from NASA.</p>
      <CountryBoard onPick={go} />
    </section>
  )
}

function LensPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="lenses" role="radiogroup">
      {LENSES.map((l) => (
        <button key={l.id} type="button" role="radio" aria-checked={value === l.id} className={`chip ${value === l.id ? 'on' : ''}`} onClick={() => onChange(l.id)}>
          <span aria-hidden="true">{l.emoji}</span> {l.label}
        </button>
      ))}
    </div>
  )
}

function Result(props: {
  q: Query
  set: (p: Partial<Query>) => void
  daily: DailySeries | null
  analysis: CityAnalysis | null
  status: LoadStatus | null
  error: string | null
  lens: Lens
  then: { first: number; last: number }
  now: { first: number; last: number }
}) {
  const { q, set, daily, analysis, status, error, then, now } = props
  const lens = LENS_BY_ID[q.lens]
  const city = q.city!
  const cityName = city.country ? `${city.name}, ${city.country}` : city.name
  const isKid = lens.id === 'kid'
  const spanLabel = (p: { first: number; last: number }) => (isKid ? `ages 0–9: ${periodLabel(p)}` : `first ten years: ${periodLabel(p)}`)
  const labels: PageLabels =
    q.mode === 'child'
      ? { then: { born: `${lens.subject} ${q.b1}`, years: spanLabel(then) }, now: { born: `${lens.subject} ${q.b2}`, years: spanLabel(now) } }
      : { then: { born: lens.subject.replace(/ (in|from|for)$/, ''), years: periodLabel(then) }, now: { born: lens.subject.replace(/ (in|from|for)$/, ''), years: periodLabel(now) } }
  const [copied, setCopied] = useState(false)

  return (
    <section className="result">
      <div className="controls">
        <label className="field grow">
          <span>City</span>
          <CitySearch value={city} onChange={(c) => set({ city: c })} />
        </label>
        <div className="field">
          <span>Compare</span>
          <div className="modes">
            <button type="button" className={`chip ${q.mode === 'child' ? 'on' : ''}`} onClick={() => set({ mode: 'child' })}>
              Two childhoods
            </button>
            <button type="button" className={`chip ${q.mode === 'free' ? 'on' : ''}`} onClick={() => set({ mode: 'free' })}>
              Any two periods
            </button>
          </div>
        </div>
        {q.mode === 'child' ? (
          <div className="field">
            <span>Born in</span>
            <div className="pair">
              <select value={q.b1} onChange={(e) => set({ b1: +e.target.value })} aria-label="First birth year">
                {years(BIRTH_YEARS.first, BIRTH_YEARS.last).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <span className="vs">vs</span>
              <select value={q.b2} onChange={(e) => set({ b2: +e.target.value })} aria-label="Second birth year">
                {years(BIRTH_YEARS.first, BIRTH_YEARS.last).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="field">
            <span>Periods</span>
            <div className="pair">
              <RangeInput value={q.p1} onChange={(p1) => set({ p1 })} label="Then" />
              <span className="vs">vs</span>
              <RangeInput value={q.p2} onChange={(p2) => set({ p2 })} label="Now" />
            </div>
          </div>
        )}
        <div className="field wide">
          <span>Who are you?</span>
          <LensPicker value={q.lens} onChange={(lensId) => set({ lens: lensId })} />
        </div>
      </div>

      <div className="titleblock">
        <h2>
          {q.mode === 'child' && isKid ? 'Two childhoods in ' : 'Two lives in '}
          {cityName}
        </h2>
        <p className="intro">{lens.intro}</p>
        <OverlapHint then={then} now={now} set={set} />
      </div>

      {error && (
        <div className="error">
          <p>Could not get the data: {error}</p>
          <button type="button" className="btn" onClick={() => set({ city: { ...city } })}>
            Try again
          </button>
        </div>
      )}
      {!error && !analysis && (
        <div className="loading">
          <div className="spinner" />
          <p>{status?.message ?? 'Loading…'}</p>
        </div>
      )}
      {analysis && daily && (
        <>
          <Scrapbook a={analysis} lens={lens} labels={labels} />
          <GlobalContext a={analysis} cityName={city.name} />
          <p className="foldbar">
            <span>Dig deeper:</span>
            <button
              type="button"
              className="linkish"
              onClick={(e) => e.currentTarget.closest('.result')?.querySelectorAll<HTMLDetailsElement>('details.fold').forEach((d) => (d.open = true))}
            >
              open all
            </button>
            <button
              type="button"
              className="linkish"
              onClick={(e) => e.currentTarget.closest('.result')?.querySelectorAll<HTMLDetailsElement>('details.fold').forEach((d) => (d.open = false))}
            >
              close all
            </button>
          </p>
          <Fold title="Two futures" teaser="What someone born in 2040 could live through, two ways.">
            <FutureBook a={analysis} lens={lens} />
          </Fold>
          <Fold title="The case file" teaser={`Everything we checked in ${city.name}, grouped by kind of evidence.`}>
            <CaseFile a={analysis} cityName={city.name} />
          </Fold>
          <Fold title="Same question, another city" teaser={`Put a second city next to ${city.name}.`} open={!!q.vs}>
            <Compare a={analysis} city={city} then={then} now={now} vs={q.vs} onVs={(vs) => set({ vs })} />
          </Fold>
          <Fold title="Why might this be?" teaser="The main reason, and what these numbers cannot see.">
            <WhyPanel country={city.country} cityName={city.name} then={then} now={now} />
          </Fold>
          <Methods a={analysis} d={daily} lens={lens} cityName={city.name} />
          <p className="share">
            <button
              type="button"
              className="btn small"
              onClick={() => {
                navigator.clipboard?.writeText(location.href).then(() => setCopied(true))
                setTimeout(() => setCopied(false), 1500)
              }}
            >
              {copied ? 'Link copied' : 'Copy link to this page'}
            </button>{' '}
            <button type="button" className="linkish" onClick={() => set({ ...DEFAULT_QUERY, city: null })}>
              start over
            </button>
          </p>
        </>
      )}
    </section>
  )
}

/** A section that starts closed, so the scrapbooks stay the story and the rest is one tap away. */
function Fold({ title, teaser, open, children }: { title: string; teaser: string; open?: boolean; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(!!open)
  useEffect(() => {
    if (open) setIsOpen(true)
  }, [open])
  return (
    <details className="fold" open={isOpen} onToggle={(e) => setIsOpen(e.currentTarget.open)}>
      <summary>
        <span className="foldtitle">{title}</span>
        <span className="foldteaser">{teaser}</span>
      </summary>
      {children}
    </details>
  )
}

/** When the two periods overlap, say so: the differences will be small by construction. */
function OverlapHint({ then, now, set }: { then: { first: number; last: number }; now: { first: number; last: number }; set: (p: Partial<Query>) => void }) {
  const lo = Math.max(then.first, now.first)
  const hi = Math.min(then.last, now.last)
  const shared = hi - lo + 1
  if (shared <= 0) return null
  const len = Math.min(then.last - then.first + 1, now.last - now.first + 1)
  return (
    <p className="overlap">
      These two lives share {shared} of their {len} years, so the differences are small.{' '}
      <button type="button" className="linkish" onClick={() => set({ mode: 'child', b1: BIRTH_YEARS.first, b2: 2015 })}>
        Try 1981 vs 2015
      </button>
    </p>
  )
}

function RangeInput({ value, onChange, label }: { value: { first: number; last: number }; onChange: (p: { first: number; last: number }) => void; label: string }) {
  const ys = years(YEARS.first, YEARS.last)
  return (
    <span className="range" aria-label={label}>
      <select value={value.first} onChange={(e) => onChange({ first: +e.target.value, last: Math.max(+e.target.value, value.last) })}>
        {ys.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      –
      <select value={value.last} onChange={(e) => onChange({ first: Math.min(value.first, +e.target.value), last: +e.target.value })}>
        {ys.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </span>
  )
}
