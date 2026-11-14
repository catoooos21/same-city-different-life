import { useMemo, useState } from 'react'
import { YEARS } from '../config/metrics'
import { COOLING, HEATING, STUDIES, costRows, percentChange } from '../cost'
import { fmtNum } from '../format'
import type { CityAnalysis } from '../metrics'
import type { DailySeries } from '../power'
import type { City } from '../state'
import { unitShort, valueDigits } from '../units'
import { changeWords } from './CaseFile'
import { TrendSentence, Verdict, periodLabel } from './Scrapbook'
import { Sparkline, YearChart } from './YearChart'
import './cost.css'

/**
 * What the heat costs. The city's own numbers (cooling need, heating need, days too hot to work)
 * come from NASA data with the page's trend test; the money figures are published studies.
 */
export function Cost({ city, a, d }: { city: City; a: CityAnalysis; d: DailySeries }) {
  const rows = useMemo(() => costRows(d, a), [d, a])
  const [open, setOpen] = useState<string | null>(null)
  const cooling = rows.find((r) => r.result.def.id === COOLING.id)?.result
  const pct = cooling ? percentChange(cooling) : null
  const heating = rows.find((r) => r.result.def.id === HEATING.id)?.result
  const hpct = heating ? percentChange(heating) : null
  // lead with whichever need is the bigger part of the bill here, so a cold city is not told its tiny cooling need "doubled"
  const heatingLeads = !!heating && (heating.then.mean ?? 0) > (cooling?.then.mean ?? 0)

  return (
    <section className="casefile cost">
      <h3>What it costs in {city.name}</h3>
      <p>
        Heat costs money in three ways: <strong>electricity</strong> for cooling, <strong>work</strong> that slows down or stops, and <strong>damage</strong> to crops, health and power grids. NASA
        measures weather, not money, so this section shows the weather numbers that the money follows.
      </p>

      {heatingLeads
        ? heating &&
          hpct !== null &&
          heating.trend?.significant &&
          Math.abs(hpct) >= 1 && (
            <p className="costsum">
              {city.name} spends more on heating than on cooling. Heating need is <strong>{fmtNum(Math.abs(hpct), 0)} %</strong> {hpct > 0 ? 'higher' : 'lower'} now ({periodLabel(a.now)}) than then (
              {periodLabel(a.then)}){hpct < 0 ? ', which saves fuel' : ''}. Cooling need is still small here{cooling && cooling.trend?.significant && cooling.trend.slope > 0 ? ', but it is growing' : ''}.
            </p>
          )
        : cooling &&
          pct !== null &&
          cooling.trend?.significant &&
          Math.abs(pct) >= 1 && (
            <p className="costsum">
              Cooling need in {city.name} is <strong>{fmtNum(Math.abs(pct), 0)} %</strong> {pct > 0 ? 'higher' : 'lower'} now ({periodLabel(a.now)}) than then ({periodLabel(a.then)}). The same home
              with the same air conditioner needs roughly that much {pct > 0 ? 'more' : 'less'} electricity to stay cool.
            </p>
          )}

      {rows.length > 0 && (
        <div className="casegroup">
          <h4>From NASA data, for this city</h4>
          <ol className="caselist">
            {rows.map(({ result: r, money }) => {
              const isOpen = open === r.def.id
              const dp = valueDigits(r.def)
              return (
                <li className={isOpen ? 'open' : ''} key={r.def.id}>
                  <button type="button" className="caserow" onClick={() => setOpen(isOpen ? null : r.def.id)} aria-expanded={isOpen}>
                    <span className="what">
                      <strong>{r.def.name}</strong>
                      <small>{money}</small>
                    </span>
                    <Sparkline r={r} />
                    <span className="howmuch">
                      {changeWords(r)}
                      {r.then.mean !== null && r.now.mean !== null && (
                        <small>
                          {fmtNum(r.then.mean, dp)} then, {fmtNum(r.now.mean, dp)} {unitShort(r.def)} now
                        </small>
                      )}
                    </span>
                    <Verdict r={r} />
                  </button>
                  {isOpen && (
                    <div className="caseopen">
                      <YearChart r={r} then={a.then} now={a.now} />
                      <TrendSentence r={r} />
                      <p className="muted small costdef">{r.def.definition}</p>
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
          <p className="hint">Tap any row to see every year since {YEARS.first}.</p>
        </div>
      )}

      <div className="casegroup">
        <h4>What studies say it costs the world</h4>
        <p className="groupnote">Published estimates, not computed on this page.</p>
        <div className="studies">
          {STUDIES.map((s) => (
            <div className="study" key={s.url}>
              <strong className="studyfig">{s.figure}</strong>
              <p>{s.what}</p>
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.source}
              </a>
            </div>
          ))}
        </div>
      </div>

      <p className="fadenote">
        This page does not put a price on {city.name}. A real bill depends on how many people work outdoors, how buildings are made, and what electricity costs here. The rows above are the part
        NASA data can show: how much the cause has changed.
      </p>
    </section>
  )
}
