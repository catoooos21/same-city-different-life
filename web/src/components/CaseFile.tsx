import { useMemo, useState } from 'react'
import type { CityAnalysis, MetricResult } from '../metrics'
import { callOf, caseMetrics, groupCases } from '../casefile'
import { YEARS } from '../config/metrics'
import { Sparkline, YearChart } from './YearChart'
import { TrendSentence, Verdict } from './Scrapbook'

export function changeWords(r: MetricResult): string {
  const call = callOf(r)
  if (call === 'none' || call === null) return 'No steady direction'
  const n = Math.abs(r.slopePerDecade!)
  const unit = r.def.unit === 'mm' ? 'mm' : n.toFixed(n < 2 ? 1 : 0) === '1' ? 'day' : 'days'
  return `${call === 'up' ? 'Up' : 'Down'} about ${n.toFixed(n < 2 ? 1 : 0)} ${unit} every ten years`
}

/** Every metric of the city, grouped by what it measures, strongest evidence first inside each group. */
export function CaseFile({ a, cityName }: { a: CityAnalysis; cityName: string }) {
  const groups = useMemo(() => groupCases(caseMetrics(a)), [a])
  const [open, setOpen] = useState<string | null>(null)
  if (!groups.length) return null
  const moving = groups.filter((g) => g.real > 0).length
  return (
    <section className="casefile">
      <h3>The case file: {cityName}</h3>
      <p>
        Everything we checked, in {groups.length} kinds of evidence.{' '}
        <strong>
          {moving} of {groups.length}
        </strong>{' '}
        {moving === 1 ? 'shows' : 'show'} a real change. Metrics in the same group measure the same thing in different ways, so we count the group, not each line.
      </p>
      {groups.map((g) => (
        <div className="casegroup" key={g.id}>
          <h4>
            {g.title}{' '}
            <span className="groupcount">
              {g.real} of {g.cases.length} with a real change
            </span>
          </h4>
          {g.note && <p className="groupnote">{g.note}</p>}
          <ol className="caselist">
            {g.cases.map((r) => {
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
        </div>
      ))}
      <p className="hint">Tap any row to see every year since {YEARS.first}.</p>
    </section>
  )
}
