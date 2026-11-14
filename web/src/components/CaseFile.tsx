import { useMemo, useState } from 'react'
import type { CityAnalysis, MetricResult } from '../metrics'
import { callOf, caseMetrics, rankCases } from '../casefile'
import { YEARS } from '../config/metrics'
import { Sparkline, YearChart } from './YearChart'
import { TrendSentence, Verdict } from './Scrapbook'

function changeWords(r: MetricResult): string {
  const call = callOf(r)
  if (call === 'none' || call === null) return 'No steady direction'
  const n = Math.abs(r.slopePerDecade!)
  const unit = r.def.unit === 'mm' ? 'mm' : n.toFixed(n < 2 ? 1 : 0) === '1' ? 'day' : 'days'
  return `${call === 'up' ? 'Up' : 'Down'} about ${n.toFixed(n < 2 ? 1 : 0)} ${unit} every ten years`
}

/** Every metric of the city, strongest evidence first. */
export function CaseFile({ a, cityName }: { a: CityAnalysis; cityName: string }) {
  const ranked = useMemo(() => rankCases(caseMetrics(a)), [a])
  const [open, setOpen] = useState<string | null>(null)
  if (!ranked.length) return null
  const real = ranked.filter((r) => r.trend!.significant).length
  return (
    <section className="casefile">
      <h3>The case file: {cityName}</h3>
      <p>
        Everything we checked, strongest evidence first.{' '}
        <strong>
          {real} of {ranked.length}
        </strong>{' '}
        {real === 1 ? 'is a real change' : 'are real changes'}; the rest show no clear change.
      </p>
      <ol className="caselist">
        {ranked.map((r) => {
          const isOpen = open === r.def.id
          return (
            <li key={r.def.id} className={isOpen ? 'open' : ''}>
              <button type="button" className="caserow" onClick={() => setOpen(isOpen ? null : r.def.id)} aria-expanded={isOpen}>
                <span className="what">
                  <strong>{r.def.name}</strong>
                  {r.def.plain && <small>{r.def.plain}</small>}
                </span>
                <Sparkline r={r} />
                <span className="howmuch">{changeWords(r)}</span>
                <Verdict r={r} />
              </button>
              {isOpen && (
                <div className="caseopen">
                  <YearChart r={r} then={a.then} now={a.now} />
                  <TrendSentence r={r} />
                </div>
              )}
            </li>
          )
        })}
      </ol>
      <p className="hint">Tap any row to see every year since {YEARS.first}.</p>
    </section>
  )
}
