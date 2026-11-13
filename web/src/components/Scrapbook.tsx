import { useState } from 'react'
import type { Lens, LensMetric } from '../config/lenses'
import type { CityAnalysis, MetricResult, Period } from '../metrics'
import { periodMonthly } from '../metrics'
import { fmtNum, fmtP, fmtSigned } from '../format'
// fmtP and fmtSigned are used by TrendSentence in the chart drawer only
import { CalendarChart, YearChart } from './YearChart'

export interface PageLabels {
  then: { born: string; years: string }
  now: { born: string; years: string }
}

function Verdict({ r }: { r: MetricResult }) {
  const t = r.trend
  if (!t) return <span className="stamp none">Too few years</span>
  if (t.significant) return <span className={`stamp real ${t.direction}`}>Real change</span>
  return <span className="stamp cant">Can’t tell</span>
}

function Tile({ r, stat, side, onClick, active }: { r: MetricResult; stat: { mean: number | null; validYears: number; totalYears: number }; side: 'then' | 'now'; onClick: () => void; active: boolean }) {
  const mm = r.def.unit === 'mm'
  return (
    <button type="button" className={`tile ${side} ${active ? 'active' : ''}`} onClick={onClick} aria-pressed={active}>
      <span className="big">{fmtNum(stat.mean, mm ? 0 : 0)}</span>
      <span className="unit">{mm ? 'mm on the wettest day' : 'days a year'}</span>
      {stat.validYears < stat.totalYears && (
        <span className="tiny">
          {stat.validYears} of {stat.totalYears} years complete
        </span>
      )}
    </button>
  )
}

/** "days too hot to play outside" -> "day too hot to play outside" when n is 1. */
function singular(phrase: string): string {
  return phrase.replace(/\b(days|nights)\b/, (w) => w.slice(0, -1))
}

function Note({ r, lm }: { r: MetricResult; lm: LensMetric }) {
  const diff = r.diff
  const mm = r.def.unit === 'mm'
  let line: string
  if (diff === null) line = 'Not enough complete years to compare.'
  else if (Math.abs(diff) < 0.5) line = `About the same ${mm ? 'biggest downpour' : lm.phrase}.`
  else {
    const n = Math.round(Math.abs(diff))
    const phrase = n === 1 ? singular(lm.phrase) : lm.phrase
    line = mm ? `${n} mm ${diff > 0 ? 'more' : 'less'} in the biggest downpour.` : `${n} ${diff > 0 ? 'more' : 'fewer'} ${phrase}, every year.`
  }
  const t = r.trend
  const worse = diff !== null && Math.abs(diff) >= 0.5 && (diff > 0) === lm.moreIsBad
  // One plain line about the long-term trend; the numbers live behind "tap any number".
  let trendWords = ''
  if (t) {
    if (!t.significant) trendWords = 'Ups and downs since 1981, no clear trend.'
    else trendWords = t.direction === 'up' ? 'Going up steadily since 1981.' : 'Going down steadily since 1981.'
  }
  return (
    <div className={`note ${worse ? 'worse' : 'better'}`}>
      <p className="line">{line}</p>
      <Verdict r={r} />
      {trendWords && <p className="trendwords">{trendWords}</p>}
    </div>
  )
}

export function Scrapbook({ a, lens, labels }: { a: CityAnalysis; lens: Lens; labels: PageLabels }) {
  const [open, setOpen] = useState<string | null>(null)
  const shown = lens.metrics.filter((lm) => a.results[lm.metric]?.shown)
  const hidden = lens.metrics.filter((lm) => a.results[lm.metric] && !a.results[lm.metric].shown)
  const openR = open ? a.results[open] : null
  const openLm = open ? lens.metrics.find((m) => m.metric === open) : null
  const calMetric = lens.calendar ? lens.metrics.find((m) => a.results[m.metric]?.monthly) : undefined
  const calR = calMetric ? a.results[calMetric.metric] : null

  return (
    <section className="scrapbook">
      <div className="pages" style={{ gridTemplateRows: `auto repeat(${shown.length}, auto)` }}>
        <header className="cell then head">
          <span className="tape" />
          <h3>Then</h3>
          <p className="born">{labels.then.born}</p>
          <p className="years">{labels.then.years}</p>
        </header>
        <div className="cell mid head">
          <p className="arrow">what changed</p>
        </div>
        <header className="cell now head">
          <span className="tape" />
          <h3>Now</h3>
          <p className="born">{labels.now.born}</p>
          <p className="years">{labels.now.years}</p>
        </header>

        {shown.map((lm, i) => {
          const r = a.results[lm.metric]
          const last = i === shown.length - 1
          return (
            <ThreeCells key={lm.metric} last={last}>
              <div className="cell then">
                <p className="caption">{lm.title}</p>
                <Tile r={r} stat={r.then} side="then" onClick={() => setOpen(open === lm.metric ? null : lm.metric)} active={open === lm.metric} />
              </div>
              <div className="cell mid">
                <Note r={r} lm={lm} />
              </div>
              <div className="cell now">
                <p className="caption">{lm.title}</p>
                <Tile r={r} stat={r.now} side="now" onClick={() => setOpen(open === lm.metric ? null : lm.metric)} active={open === lm.metric} />
              </div>
            </ThreeCells>
          )
        })}
      </div>

      {hidden.length > 0 && (
        <p className="muted hiddennote">
          Not shown here because it hardly ever happens in this city: {hidden.map((h) => h.title.toLowerCase()).join(', ')}.
        </p>
      )}
      {lens.caveat && <p className="caveat">{lens.caveat}</p>}
      <p className="hint">Tap any number to see every year since 1981, with the full statistics.</p>

      {openR && openLm && (
        <div className="drawer">
          <h4>
            {openLm.title}: every year, 1981–2025
          </h4>
          <YearChart r={openR} then={a.then} now={a.now} />
          <TrendSentence r={openR} />
          <p className="muted">{openR.def.definition}</p>
        </div>
      )}

      {calR && calR.monthly && (
        <div className="drawer calendar">
          <h4>Outdoor calendar: {calMetric!.title.toLowerCase()} per month</h4>
          <CalendarChart then={periodMonthly(calR.monthly, a.then)} now={periodMonthly(calR.monthly, a.now)} labels={{ then: labels.then.years, now: labels.now.years }} />
          <p className="muted">Average days per month in each period. Months are in calendar order, so a southern-hemisphere summer sits at both ends.</p>
        </div>
      )}
    </section>
  )
}

function ThreeCells({ children, last }: { children: React.ReactNode; last: boolean }) {
  return <div className={`row ${last ? 'last' : ''}`}>{children}</div>
}

export function TrendSentence({ r }: { r: MetricResult }) {
  const t = r.trend
  if (!t) return <p className="muted">Fewer than ten complete years, so no trend test was run.</p>
  const mm = r.def.unit === 'mm'
  return (
    <p className="trendsentence">
      {t.significant ? (
        <>
          <strong>Real change.</strong> The trend is {fmtSigned(r.slopePerDecade, 1)} {mm ? 'mm' : 'days'} per decade (95% confidence interval {fmtSigned(r.ciPerDecade![0], 1)} to {fmtSigned(r.ciPerDecade![1], 1)}), Mann-Kendall {fmtP(t.p)} over {t.n} years.
          {t.fallback && ' The autocorrelation correction failed on this series, so the plain Mann-Kendall test was used.'}
        </>
      ) : (
        <>
          <strong>Can’t tell.</strong> The year-to-year wobble is too big to be sure of a trend: Sen’s slope is {fmtSigned(r.slopePerDecade, 1)} {mm ? 'mm' : 'days'} per decade, but the 95% confidence interval ({fmtSigned(r.ciPerDecade![0], 1)} to {fmtSigned(r.ciPerDecade![1], 1)}) includes zero and Mann-Kendall gives {fmtP(t.p)} over {t.n} years.
        </>
      )}
    </p>
  )
}

export function periodLabel(p: Period): string {
  return `${p.first}–${p.last}`
}
