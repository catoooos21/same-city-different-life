import { useMemo, useState } from 'react'
import type { CityAnalysis, MetricResult } from '../metrics'
import { basicMetrics, callOf, caseMetrics, groupCases } from '../casefile'
import { YEARS } from '../config/metrics'
import { fmtNum } from '../format'
import { rateDigits, unitShort, valueDigits } from '../units'
import { Sparkline, YearChart } from './YearChart'
import { TrendSentence, Verdict } from './Scrapbook'

export function changeWords(r: MetricResult): string {
  const call = callOf(r)
  if (call === 'none' || call === null) return 'No steady direction'
  const n = Math.abs(r.slopePerDecade!)
  const shown = n.toFixed(rateDigits(r.def, n))
  return `${call === 'up' ? 'Up' : 'Down'} about ${shown} ${unitShort(r.def, +shown)} every ten years`
}

function CaseRow({ r, a, open, onToggle, levels }: { r: MetricResult; a: CityAnalysis; open: boolean; onToggle: () => void; levels?: boolean }) {
  const dp = valueDigits(r.def)
  return (
    <li className={open ? 'open' : ''}>
      <button type="button" className="caserow" onClick={onToggle} aria-expanded={open}>
        <span className="what">
          <strong>{r.def.name}</strong>
          {r.def.plain && <small>{r.def.plain}</small>}
        </span>
        <Sparkline r={r} />
        <span className="howmuch">
          {changeWords(r)}
          {levels && r.then.mean !== null && r.now.mean !== null && (
            <small>
              {fmtNum(r.then.mean, dp)} then, {fmtNum(r.now.mean, dp)} {unitShort(r.def)} now
            </small>
          )}
        </span>
        <Verdict r={r} />
      </button>
      {open && (
        <div className="caseopen">
          <YearChart r={r} then={a.then} now={a.now} />
          <TrendSentence r={r} />
        </div>
      )}
    </li>
  )
}

/**
 * Every measure of the city. First the basics (plain temperature and rain), then the counted days
 * grouped by what they measure, strongest evidence first inside each group.
 */
export function CaseFile({ a, cityName }: { a: CityAnalysis; cityName: string }) {
  const basics = useMemo(() => basicMetrics(a), [a])
  const groups = useMemo(() => groupCases(caseMetrics(a)), [a])
  const [open, setOpen] = useState<string | null>(null)
  if (!groups.length && !basics.length) return null
  const moving = groups.filter((g) => g.real > 0).length
  const toggle = (id: string) => setOpen(open === id ? null : id)
  return (
    <section className="casefile">
      <h3>The case file: {cityName}</h3>
      <p>
        Everything we checked: the basics first, then {groups.length} kinds of evidence built from them.{' '}
        <strong>
          {moving} of {groups.length}
        </strong>{' '}
        {moving === 1 ? 'shows' : 'show'} a real change. Measures in the same group read the same thing in different ways, so we count the group, not each line.
      </p>

      {basics.length > 0 && (
        <div className="casegroup basics">
          <h4>The basics</h4>
          <p className="groupnote">Plain temperature and rain, before any counting of days. Everything below is built from these same daily values.</p>
          <ol className="caselist">
            {basics.map((r) => (
              <CaseRow key={r.def.id} r={r} a={a} open={open === r.def.id} onToggle={() => toggle(r.def.id)} levels />
            ))}
          </ol>
        </div>
      )}

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
            {g.cases.map((r) => (
              <CaseRow key={r.def.id} r={r} a={a} open={open === r.def.id} onToggle={() => toggle(r.def.id)} />
            ))}
          </ol>
        </div>
      ))}
      <p className="hint">Tap any row to see every year since {YEARS.first}.</p>
    </section>
  )
}
