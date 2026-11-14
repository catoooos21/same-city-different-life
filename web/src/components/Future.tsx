import { useState } from 'react'
import type { Lens } from '../config/lenses'
import { CHILDHOOD_LENGTH, YEARS } from '../config/metrics'
import type { CityAnalysis, MetricResult } from '../metrics'
import { FUTURE_BIRTH_YEARS, SLOWER_PACE, whatIf, type WhatIf } from '../future'
import { fmtNum } from '../format'
import { unitLong } from '../units'
import { FUTURE_NOTE, FUTURE_SOURCES, KEEPS_GOING, ON_TOP_COOLER, ON_TOP_HOTTER, SLOWS_DOWN } from '../config/context'

function unitWords(r: MetricResult): string {
  return unitLong(r.def)
}

function FutureTile({ w, r, kind }: { w: WhatIf; r: MetricResult; kind: 'same' | 'slower' }) {
  const lo = Math.round(w.lo)
  const hi = Math.round(w.hi)
  return (
    <div className={`tile future ${kind}`}>
      <span className="big">{fmtNum(w.value, 0)}</span>
      <span className="unit">{unitWords(r)}</span>
      {lo !== hi && (
        <span className="tiny">
          somewhere between {lo} and {hi}
        </span>
      )}
    </div>
  )
}

/** Two what-if pages for a kid not born yet: the trend at the same pace, and at half the pace. */
export function FutureBook({ a, lens }: { a: CityAnalysis; lens: Lens }) {
  const [birth, setBirth] = useState(FUTURE_BIRTH_YEARS[1])
  const shown = lens.metrics.filter((lm) => a.results[lm.metric]?.shown)
  const rows = shown.filter((lm) => whatIf(a.results[lm.metric], birth) !== null)
  const flat = shown.filter((lm) => whatIf(a.results[lm.metric], birth) === null)
  if (!rows.length) return null
  const last = birth + CHILDHOOD_LENGTH - 1
  const subject = `${lens.subject} ${birth}`

  return (
    <section className="futurebook">
      <div className="futurehead">
        <h3>Two futures</h3>
        <span className="stamp whatif">What-if, not a forecast</span>
      </div>
      <p>
        {subject} has not lived these years yet ({birth}–{last}). Here are two ways they could go, drawn from the same {YEARS.first}–{YEARS.last} trend line.
      </p>
      <div className="field">
        <span>Born in</span>
        <div className="modes" role="radiogroup" aria-label="Future birth year">
          {FUTURE_BIRTH_YEARS.map((y) => (
            <button key={y} type="button" role="radio" aria-checked={birth === y} className={`chip ${birth === y ? 'on' : ''}`} onClick={() => setBirth(y)}>
              {y}
            </button>
          ))}
        </div>
      </div>

      <div className="futuregrid">
        <div className="fcell fhead label" />
        <div className="fcell fhead">
          <h4>Now</h4>
          <p>
            {a.now.first}–{a.now.last}, measured
          </p>
        </div>
        <div className="fcell fhead same">
          <h4>If it keeps going</h4>
          <p>same pace as the last {YEARS.last - YEARS.first + 1} years</p>
        </div>
        <div className="fcell fhead slower">
          <h4>
            If it slows down <span className="exampletag">example</span>
          </h4>
          <p>
            say, {SLOWER_PACE === 0.5 ? 'half' : `${Math.round(SLOWER_PACE * 100)} % of`} that pace from {YEARS.last + 1} on
          </p>
        </div>

        {rows.map((lm) => {
          const r = a.results[lm.metric]
          return (
            <div className="frow" key={lm.metric}>
              <div className="fcell label">
                <strong>{lm.title}</strong>
              </div>
              <div className="fcell">
                <div className="tile now">
                  <span className="big">{fmtNum(r.now.mean, 0)}</span>
                  <span className="unit">{unitWords(r)}</span>
                </div>
              </div>
              <div className="fcell same">
                <FutureTile w={whatIf(r, birth, 1)!} r={r} kind="same" />
              </div>
              <div className="fcell slower">
                <FutureTile w={whatIf(r, birth, SLOWER_PACE)!} r={r} kind="slower" />
              </div>
            </div>
          )
        })}
      </div>

      {flat.length > 0 && <p className="muted hiddennote">No what-if for {flat.map((f) => f.title.toLowerCase()).join(', ')}: no clear change so far, so there is no line to extend.</p>}
      <div className="futurehow">
        <div className="how same">
          <h4>How it could keep going</h4>
          <ul>
            <li className="main">
              <span className="maintag">Main reason</span>
              {KEEPS_GOING[0]}
            </li>
          </ul>
          <p className="ontop">{ON_TOP_HOTTER}</p>
          <ul>
            {KEEPS_GOING.slice(1).map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
        <div className="how slower">
          <h4>How it could slow down</h4>
          <ul>
            <li className="main">
              <span className="maintag">Main fix</span>
              {SLOWS_DOWN[0]}
            </li>
          </ul>
          <p className="ontop">{ON_TOP_COOLER}</p>
          <ul>
            {SLOWS_DOWN.slice(1).map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      </div>
      <p className="small">{FUTURE_NOTE}</p>
      <p className="muted small">
        This is context from research, not something the data here can prove. Sources:{' '}
        {FUTURE_SOURCES.map((s, i) => (
          <span key={s.url}>
            {i > 0 && ' · '}
            <a href={s.url}>{s.label}</a>
          </span>
        ))}
      </p>
      <p className="caveat">
        These are straight lines, not climate-model projections. “Half the pace” is only an example we picked to show a slower future; it is not a scenario from climate science. Nobody knows the pace of the next decades; it depends on what the world and the city do. The range under “keeps going” is the same line drawn with the uncertainty of the trend.
      </p>
    </section>
  )
}
