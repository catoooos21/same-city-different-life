import { useLang } from '../lang'
import type { Verdict, Variable, VariableSource } from '../types'

export function Unavailable({ what }: { what?: string }) {
  const { t } = useLang()
  return (
    <div className="unavailable" role="status">
      <strong>{t('dataUnavailable')}</strong>
      {what ? <span className="mono"> {what}</span> : null}
      <p>{t('dataUnavailableDetail')}</p>
    </div>
  )
}

export function Loading() {
  const { t } = useLang()
  return <p className="loading">{t('loading')}</p>
}

export function Stamp({ stamp }: { stamp: Verdict['stamp'] }) {
  const { t } = useLang()
  const closed = stamp === 'CASE CLOSED'
  return <div className={closed ? 'stamp closed' : 'stamp inconclusive'}>{closed ? t('caseClosed') : t('inconclusive')}</div>
}

export function VerdictCard({ verdict }: { verdict: Verdict }) {
  const { t, pick } = useLang()
  return (
    <section className="folder verdict">
      <Stamp stamp={verdict.stamp} />
      <p className="label">{t('verdictLabel')}</p>
      <h2>{pick(verdict.headline, verdict.headline_ar)}</h2>
      <dl className="answers">
        <div><dt>{t('qWhat')}</dt><dd>{pick(verdict.what, verdict.what_ar)}</dd></div>
        <div><dt>{t('qWhere')}</dt><dd>{pick(verdict.where, verdict.where_ar)}</dd></div>
        <div><dt>{t('qHowMuch')}</dt><dd>{pick(verdict.how_much, verdict.how_much_ar)}</dd></div>
        <div><dt>{t('qSignificant')}</dt><dd>{verdict.significant}</dd></div>
      </dl>
      <p className="verdict-text">{pick(verdict.text, verdict.text_ar)}</p>
    </section>
  )
}

export function SourceLine({ v }: { v: Variable }) {
  const { t, pick } = useLang()
  const s: VariableSource = v.source
  const fallback = s.access !== 'earthdata'
  return (
    <div className="src">
      <p className="mono">
        {pick(v.label, v.label_ar)}{v.unit ? ` (${v.unit})` : ''} · {s.short_name} v{s.version} · {s.variable} · {s.daac}
        {s.doi ? <> · <a href={`https://doi.org/${s.doi}`} target="_blank" rel="noreferrer">doi:{s.doi}</a></> : null}
      </p>
      {fallback && (
        <p className="pill fallback">
          {t('fallbackBadge')}: {s.fallback_source ?? 'NASA POWER'}. {s.fallback_note}
        </p>
      )}
      {v.description && <p className="note">{v.description}</p>}
    </div>
  )
}

export function fmt(x: number | null | undefined, d = 2): string {
  return x === null || x === undefined ? '-' : x.toFixed(d)
}

function fmtP(p: number | null | undefined): string {
  if (p === null || p === undefined) return '-'
  return p < 0.001 ? '< 0.001' : p.toFixed(3)
}

export function TrendFacts({ v }: { v: Variable }) {
  const { t } = useLang()
  const tr = v.trend
  if (!tr) return <p className="note">{t('trendNotRun')}</p>
  const ci = tr.ci95_per_decade
  const d = Math.abs(tr.slope_per_decade ?? 0) >= 0.05 ? 2 : 3
  const sk = v.seasonal_kendall
  return (
    <ul className="facts">
      <li>
        <span>{t('slopeLabel')}</span>
        <strong>
          {fmt(tr.slope_per_decade, d)} {v.unit}
          {ci ? <small> [{fmt(ci[0], d)}, {fmt(ci[1], d)}]</small> : null}
        </strong>
      </li>
      <li><span>{t('totalLabel')} {''}</span><strong>{fmt(tr.total_change, d)} {v.unit}{tr.pct_change_vs_baseline !== null ? <small> ({tr.pct_change_vs_baseline > 0 ? '+' : ''}{fmt(tr.pct_change_vs_baseline, 1)}%)</small> : null}</strong></li>
      <li><span>{t('pLabel')}</span><strong>{fmtP(tr.p_value)}</strong></li>
      <li><span>{t('nLabel')}</span><strong>{tr.n ?? '-'}</strong></li>
      {sk && (
        <li><span>{t('seasonalLabel')}</span><strong>{fmt(sk.slope_per_decade, d)} {v.unit} <small>p {fmtP(sk.p_value)}</small></strong></li>
      )}
    </ul>
  )
}
