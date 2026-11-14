import { useMemo } from 'react'
import type { Lens } from '../config/lenses'
import { fmtNum } from '../format'
import { headline } from '../headline'
import type { CityAnalysis } from '../metrics'
import { unitLong, valueDigits } from '../units'
import { Verdict } from './Scrapbook'
import './headline.css'

/** The first thing under the title: the strongest finding for this life, in one line. */
export function Headline({ a, lens }: { a: CityAnalysis; lens: Lens }) {
  const h = useMemo(() => headline(a, lens), [a, lens])
  if (!h) return null
  const dp = valueDigits(h.r.def)
  return (
    <div className={`headline ${h.worse ? 'worse' : 'better'}`}>
      <p className="headlabel">The clearest change</p>
      <p className="headbig">{h.line}</p>
      <p className="headsub">
        <Verdict r={h.r} />
        <span>
          <strong>{fmtNum(h.r.then.mean, dp)}</strong> then, <strong>{fmtNum(h.r.now.mean, dp)}</strong> now ({unitLong(h.r.def)}).
        </span>
        <span>
          {h.real} of {h.total} measures below show a real change.
        </span>
      </p>
    </div>
  )
}
