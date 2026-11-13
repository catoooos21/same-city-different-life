import type { MetricResult, Period } from '../metrics'
import { YEARS } from '../config/metrics'

/** Every year since 1981 as hand-drawn-looking dots, with Sen's slope line and the two periods shaded. */
export function YearChart({ r, then, now, height = 180 }: { r: MetricResult; then: Period; now: Period; height?: number }) {
  const W = 640
  const H = height
  const pad = { l: 40, r: 12, t: 14, b: 26 }
  const years = r.annual.years
  const vals = r.annual.values
  const finite = vals.filter((v): v is number => v !== null)
  if (!finite.length) return <p className="muted">No complete years for this metric.</p>
  let lo = Math.min(...finite)
  let hi = Math.max(...finite)
  if (r.trend) {
    const t = r.trend
    lo = Math.min(lo, t.intercept + t.slope * YEARS.first, t.intercept + t.slope * YEARS.last)
    hi = Math.max(hi, t.intercept + t.slope * YEARS.first, t.intercept + t.slope * YEARS.last)
  }
  if (lo > 0) lo = 0
  if (hi === lo) hi = lo + 1
  const span = hi - lo
  lo -= span * 0.05
  hi += span * 0.08
  const x = (y: number) => pad.l + ((y - YEARS.first + 0.5) / (YEARS.last - YEARS.first + 1)) * (W - pad.l - pad.r)
  const yv = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b)
  const bandX = (p: Period) => ({ x0: x(p.first) - (x(p.first + 1) - x(p.first)) / 2, x1: x(p.last) + (x(p.last) - x(p.last - 1 < p.first ? p.last : p.last - 1)) / 2 })
  const b1 = bandX(then)
  const b2 = bandX(now)
  const ticks = niceTicks(lo, hi, 4)
  const t = r.trend
  const unit = r.def.unit === 'mm' ? 'mm' : 'days'
  const title = `${r.def.name}, ${YEARS.first}–${YEARS.last}`

  return (
    <svg className="yearchart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} preserveAspectRatio="xMidYMid meet">
      <rect x={b1.x0} y={pad.t} width={b1.x1 - b1.x0} height={H - pad.t - pad.b} className="band then" />
      <rect x={b2.x0} y={pad.t} width={b2.x1 - b2.x0} height={H - pad.t - pad.b} className="band now" />
      {ticks.map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={yv(v)} y2={yv(v)} className="grid" />
          <text x={pad.l - 6} y={yv(v) + 4} textAnchor="end" className="tick">
            {Math.abs(v) >= 100 ? Math.round(v) : +v.toFixed(1)}
          </text>
        </g>
      ))}
      {[1981, 1990, 2000, 2010, 2020, 2025].map((yr) => (
        <text key={yr} x={x(yr)} y={H - 8} textAnchor="middle" className="tick">
          {yr}
        </text>
      ))}
      <text x={pad.l - 6} y={pad.t - 2} textAnchor="end" className="tick unit">
        {unit}
      </text>
      {t && (
        <line x1={x(YEARS.first)} x2={x(YEARS.last)} y1={yv(t.intercept + t.slope * YEARS.first)} y2={yv(t.intercept + t.slope * YEARS.last)} className={`trend ${t.significant ? 'sig' : 'nsig'}`} />
      )}
      {years.map((yr, i) => {
        const v = vals[i]
        if (v === null)
          return (
            <text key={yr} x={x(yr)} y={H - pad.b - 4} textAnchor="middle" className="gap">
              ×
            </text>
          )
        return <circle key={yr} cx={x(yr)} cy={yv(v)} r={3.2} className="dot" />
      })}
      <text x={b1.x0 + 4} y={pad.t + 12} className="bandlabel">
        then
      </text>
      <text x={b2.x0 + 4} y={pad.t + 12} className="bandlabel">
        now
      </text>
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
      <g className="legend">
        <rect x={W - 150} y={pad.t} width={12} height={12} className="bar then" />
        <text x={W - 134} y={pad.t + 10} className="tick">
          {labels.then}
        </text>
        <rect x={W - 80} y={pad.t} width={12} height={12} className="bar now" />
        <text x={W - 64} y={pad.t + 10} className="tick">
          {labels.now}
        </text>
      </g>
    </svg>
  )
}
