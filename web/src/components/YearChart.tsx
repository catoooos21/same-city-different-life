import type { MetricResult, Period } from '../metrics'
import { YEARS } from '../config/metrics'
import { axisFromZero, unitShort } from '../units'

/**
 * Every year as hand-drawn-looking dots, with Sen's slope line and the two periods shaded.
 * `first` starts the time axis later than 1981 (the satellite rain record starts in 1998);
 * `bands={false}` leaves out the then/now shading where those periods mean nothing.
 */
export function YearChart({
  r,
  then,
  now,
  height = 180,
  showTrend = true,
  first = YEARS.first,
  bands = true,
}: {
  r: MetricResult
  then: Period
  now: Period
  height?: number
  showTrend?: boolean
  first?: number
  bands?: boolean
}) {
  const W = 640
  const H = height
  const pad = { l: 40, r: 12, t: 14, b: 26 }
  const years = r.annual.years
  const vals = r.annual.values
  const finite = vals.filter((v, i): v is number => v !== null && years[i] >= first)
  if (!finite.length) return <p className="muted">No complete years for this metric.</p>
  let lo = Math.min(...finite)
  let hi = Math.max(...finite)
  if (r.trend && showTrend) {
    const t = r.trend
    lo = Math.min(lo, t.intercept + t.slope * first, t.intercept + t.slope * YEARS.last)
    hi = Math.max(hi, t.intercept + t.slope * first, t.intercept + t.slope * YEARS.last)
  }
  if (lo > 0 && axisFromZero(r.def)) lo = 0
  if (hi === lo) hi = lo + 1
  const span = hi - lo
  lo -= span * 0.05
  hi += span * 0.08
  const x = (y: number) => pad.l + ((y - first + 0.5) / (YEARS.last - first + 1)) * (W - pad.l - pad.r)
  const yv = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b)
  const bandX = (p: Period) => ({ x0: x(p.first) - (x(p.first + 1) - x(p.first)) / 2, x1: x(p.last) + (x(p.last) - x(p.last - 1 < p.first ? p.last : p.last - 1)) / 2 })
  const b1 = bandX(then)
  const b2 = bandX(now)
  const ticks = niceTicks(lo, hi, 4)
  const t = showTrend ? r.trend : null
  const unit = unitShort(r.def)
  const title = `${r.def.name}, ${first}–${YEARS.last}`
  // decade labels, dropping any that would sit on top of the first year
  const yearTicks = [first, ...[1990, 2000, 2010, 2020].filter((y) => y > first + 3), YEARS.last]

  return (
    <svg className="yearchart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} preserveAspectRatio="xMidYMid meet">
      {bands && (
        <>
          <rect x={b1.x0} y={pad.t} width={b1.x1 - b1.x0} height={H - pad.t - pad.b} className="band then" />
          <rect x={b2.x0} y={pad.t} width={b2.x1 - b2.x0} height={H - pad.t - pad.b} className="band now" />
        </>
      )}
      {ticks.map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={yv(v)} y2={yv(v)} className="grid" />
          <text x={pad.l - 6} y={yv(v) + 4} textAnchor="end" className="tick">
            {Math.abs(v) >= 100 ? Math.round(v) : +v.toFixed(1)}
          </text>
        </g>
      ))}
      {yearTicks.map((yr) => (
        <text key={yr} x={x(yr)} y={H - 8} textAnchor="middle" className="tick">
          {yr}
        </text>
      ))}
      <text x={pad.l - 6} y={pad.t - 2} textAnchor="end" className="tick unit">
        {unit}
      </text>
      {t && <line x1={x(first)} x2={x(YEARS.last)} y1={yv(t.intercept + t.slope * first)} y2={yv(t.intercept + t.slope * YEARS.last)} className={`trend ${t.significant ? 'sig' : 'nsig'}`} />}
      {years.map((yr, i) => {
        if (yr < first) return null
        const v = vals[i]
        if (v === null)
          return (
            <text key={yr} x={x(yr)} y={H - pad.b - 4} textAnchor="middle" className="gap">
              ×
            </text>
          )
        return <circle key={yr} cx={x(yr)} cy={yv(v)} r={3.2} className="dot" />
      })}
      {bands && (
        <>
          <text x={b1.x0 + 4} y={pad.t + 12} className="bandlabel">
            then
          </text>
          <text x={b2.x0 + 4} y={pad.t + 12} className="bandlabel">
            now
          </text>
        </>
      )}
    </svg>
  )
}

/** Tiny line for a sticky note or a case-file row: the evidence at a glance. `first` as in YearChart. */
export function Sparkline({ r, showTrend = true, first = YEARS.first }: { r: MetricResult; showTrend?: boolean; first?: number }) {
  const W = 160
  const H = 36
  const pad = 3
  const years = r.annual.years
  const vals = r.annual.values
  const finite = vals.filter((v, i): v is number => v !== null && years[i] >= first)
  if (finite.length < 2) return null
  const t = showTrend ? r.trend : null
  let lo = Math.min(...finite)
  let hi = Math.max(...finite)
  if (t) {
    lo = Math.min(lo, t.intercept + t.slope * first, t.intercept + t.slope * YEARS.last)
    hi = Math.max(hi, t.intercept + t.slope * first, t.intercept + t.slope * YEARS.last)
  }
  if (hi === lo) hi = lo + 1
  const x = (y: number) => pad + ((y - first) / (YEARS.last - first)) * (W - 2 * pad)
  const yv = (v: number) => pad + (1 - (v - lo) / (hi - lo)) * (H - 2 * pad)
  const points = years
    .map((yr, i) => (vals[i] === null || yr < first ? null : `${x(yr).toFixed(1)},${yv(vals[i] as number).toFixed(1)}`))
    .filter(Boolean)
    .join(' ')
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${r.def.name}, every year ${first}–${YEARS.last}`} preserveAspectRatio="none">
      <polyline points={points} className="sparkline" />
      {t && <line x1={x(first)} x2={x(YEARS.last)} y1={yv(t.intercept + t.slope * first)} y2={yv(t.intercept + t.slope * YEARS.last)} className={`sparktrend ${t.significant ? 'sig' : 'nsig'}`} />}
    </svg>
  )
}

function niceTicks(lo: number, hi: number, n: number): number[] {
  const raw = (hi - lo) / n
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag
  const out: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(+v.toFixed(6))
  return out
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Month-by-month calendar: Then vs Now bars (average days per month in each period). */
export function CalendarChart({ then, now, labels }: { then: (number | null)[]; now: (number | null)[]; labels: { then: string; now: string } }) {
  const W = 640
  const H = 170
  const pad = { l: 28, r: 8, t: 10, b: 24 }
  const max = Math.max(1, ...then.map((v) => v ?? 0), ...now.map((v) => v ?? 0))
  const slot = (W - pad.l - pad.r) / 12
  const bw = slot * 0.36
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b)
  return (
    <>
    <p className="callegend">
      <span>
        <i className="swatch then" /> Then: {labels.then}
      </span>
      <span>
        <i className="swatch now" /> Now: {labels.now}
      </span>
    </p>
    <svg className="calchart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Perfect outdoor days per month, then and now">
      {[0, Math.round(max / 2), Math.round(max)].map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="grid" />
          <text x={pad.l - 5} y={y(v) + 4} textAnchor="end" className="tick">
            {v}
          </text>
        </g>
      ))}
      {MONTHS.map((m, i) => {
        const cx = pad.l + slot * i + slot / 2
        const a = then[i]
        const b = now[i]
        return (
          <g key={m}>
            {a !== null && <rect x={cx - bw - 1} y={y(a)} width={bw} height={H - pad.b - y(a)} className="bar then" />}
            {b !== null && <rect x={cx + 1} y={y(b)} width={bw} height={H - pad.b - y(b)} className="bar now" />}
            <text x={cx} y={H - 8} textAnchor="middle" className="tick">
              {m}
            </text>
          </g>
        )
      })}
    </svg>
    </>
  )
}
