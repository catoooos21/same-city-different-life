import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useJson } from './data'
import { useLang } from './lang'
import type { CaseFile, CaseSummary, IndexFile, RegionInfo } from './types'
import { Loading, SourceLine, Stamp, TrendFacts, Unavailable, VerdictCard } from './components/Bits'
import { AnnualTrendChart, ConnectedScatter, HeatStrip, MonthlyChart, VsWorld, type ConnectedFile } from './components/Charts'
import { TrendMap } from './components/TrendMap'

function MagnifierIcon() {
  return (
    <svg className="mag" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="26" cy="26" r="16" fill="none" stroke="currentColor" strokeWidth="5" />
      <line x1="38" y1="38" x2="58" y2="58" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
    </svg>
  )
}

const CASE_EMOJI: Record<string, string> = { heat: '🌡️', dust: '🌪️', sea: '🌊', connected: '🔗' }

function CaseCard({ c }: { c: CaseSummary }) {
  const { t, pick } = useLang()
  const first = c.regions[0]
  const f = useJson<CaseFile>(c.status === 'ok' && first ? `cases/${c.id}/${first}.json` : null)
  return (
    <article className="folder card">
      <div className="tab">{t('caseNo')} {c.id.toUpperCase()}</div>
      <h3>{CASE_EMOJI[c.id] ?? ''} {pick(c.title, c.title_ar)}</h3>
      <p className="question">{pick(c.question, c.question_ar)}</p>
      <div className="card-verdict">
        {c.status !== 'ok' ? (
          <span className="muted">{t('dataUnavailable')}</span>
        ) : f.state === 'loading' ? (
          <span className="loading">{t('loading')}</span>
        ) : f.state === 'ok' ? (
          <>
            <Stamp stamp={f.data.verdict.stamp} />
            <strong>{f.data.verdict.headline}</strong>
            <span className="note">{pick(f.data.verdict.how_much, f.data.verdict.how_much_ar)}</span>
          </>
        ) : (
          <span className="muted">{t('dataUnavailable')}</span>
        )}
      </div>
      {c.status === 'ok' ? (
        <Link className="btn" to={`/case/${c.id}`}>{t('openCase')}</Link>
      ) : (
        <span className="btn disabled">{t('caseSealed')}</span>
      )}
    </article>
  )
}

export function Home() {
  const { t } = useLang()
  const idx = useJson<IndexFile>('index.json')
  return (
    <>
      <section className="hero">
        <MagnifierIcon />
        <div>
          <h1>{t('heroTitle')}</h1>
          <p>{t('heroText')}</p>
        </div>
      </section>
      <h2 className="section-title">{t('casesHeading')}</h2>
      {idx.state === 'loading' && <Loading />}
      {idx.state === 'unavailable' && <Unavailable what="index.json" />}
      {idx.state === 'ok' && (
        <div className="cards">
          {idx.data.cases.map((c) => (
            <CaseCard key={c.id} c={c} />
          ))}
        </div>
      )}
    </>
  )
}

function CaseBody({ caseId, region }: { caseId: string; region: string }) {
  const { t, pick, lang } = useLang()
  const file = useJson<CaseFile>(`cases/${caseId}/${region}.json`)
  const [varId, setVarId] = useState<string | null>(null)
  useEffect(() => setVarId(null), [caseId, region])

  if (file.state === 'loading') return <Loading />
  if (file.state === 'unavailable') return <Unavailable what={`cases/${caseId}/${region}.json`} />
  const f = file.data
  const v = f.variables.find((x) => x.id === varId) ?? f.variables.find((x) => x.primary) ?? f.variables[0]
  const global = f.comparison?.global
  const limitations = lang === 'ar' && f.limitations_ar?.length ? f.limitations_ar : f.limitations
  return (
    <>
      <VerdictCard verdict={f.verdict} />
      {caseId === 'connected' ? (
        <div className="folder"><ConnectedScatter f={f as unknown as ConnectedFile} /></div>
      ) : f.variables.length === 0 || !v ? (
        <Unavailable />
      ) : (
        <>
          <h2 className="section-title">{t('evidenceBoard')}</h2>
          {f.variables.length > 1 && (
            <div className="tabs" role="tablist" aria-label={t('variable')}>
              {f.variables.map((x) => (
                <button
                  key={x.id}
                  role="tab"
                  aria-selected={x.id === v.id}
                  className={x.id === v.id ? 'on' : ''}
                  onClick={() => setVarId(x.id)}
                >
                  {pick(x.label, x.label_ar)}{x.primary ? ' ★' : ''}
                </button>
              ))}
            </div>
          )}
          <SourceLine v={v} />
          <TrendFacts v={v} />
          <div className="grid2">
            <div className="folder"><AnnualTrendChart v={v} /></div>
            <div className="folder"><TrendMap caseId={caseId} variableId={v.id} /></div>
          </div>
          <div className="folder"><MonthlyChart v={v} /></div>
          <div className="folder"><HeatStrip v={v} /></div>
          {global && v.primary && (
            <div className="folder"><VsWorld g={global} kuwait={v} /></div>
          )}
        </>
      )}
      <section className="folder">
        <h2>{t('evidence')}</h2>
        <div className="grid2">
          <div>
            <h3>{t('evidenceList')}</h3>
            <ul>{f.evidence.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </div>
          <div>
            <h3>{t('limitations')}</h3>
            <ul>{limitations.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </div>
        </div>
        <p className="note">
          {pick(f.region.name, f.region.name_ar)} · {f.period.start}-{f.period.end} · {t('baseline')} {f.period.baseline[0]}-{f.period.baseline[1]}
        </p>
      </section>
    </>
  )
}

export function CasePage() {
  const { caseId = '' } = useParams()
  const { t, pick } = useLang()
  const idx = useJson<IndexFile>('index.json')
  const summary = idx.state === 'ok' ? idx.data.cases.find((c) => c.id === caseId) : undefined
  const regionIds = summary?.regions ?? []
  const [region, setRegion] = useState<string>('')
  useEffect(() => {
    if (regionIds.length && !regionIds.includes(region)) setRegion(regionIds[0])
  }, [regionIds, region])
  const allRegions: RegionInfo[] = idx.state === 'ok' ? [...idx.data.regions.land, ...idx.data.regions.sea] : []
  const nameOf = (id: string) => {
    const r = allRegions.find((x) => x.id === id)
    return r ? pick(r.name, r.name_ar) : id.replace(/_/g, ' ')
  }

  return (
    <>
      <Link to="/" className="back">← {t('back')}</Link>
      {idx.state === 'ok' && summary && (
        <header className="case-head">
          <h1>{pick(summary.title, summary.title_ar)}</h1>
          <p className="question">{pick(summary.question, summary.question_ar)}</p>
        </header>
      )}
      {idx.state === 'ok' && !summary && <Unavailable what={caseId} />}
      {idx.state === 'ok' && summary && summary.status !== 'ok' && <Unavailable what={summary.error ?? caseId} />}
      {idx.state === 'unavailable' && <Unavailable what="index.json" />}
      {idx.state === 'loading' && <Loading />}
      {summary && summary.status === 'ok' && region && (
        <>
          {regionIds.length > 1 && (
            <div className="picker" role="tablist" aria-label={t('region')}>
              <span>{t('region')}:</span>
              {regionIds.map((r) => (
                <button key={r} role="tab" aria-selected={r === region} className={r === region ? 'on' : ''} onClick={() => setRegion(r)}>
                  {nameOf(r)}
                </button>
              ))}
            </div>
          )}
          <CaseBody caseId={caseId} region={region} />
        </>
      )}
    </>
  )
}

const STATUS_KEY = { ok: 'statusOk', fallback: 'statusFallback', unavailable: 'statusUnavailable' } as const

export function About() {
  const { t } = useLang()
  const idx = useJson<IndexFile>('index.json')
  return (
    <>
      <h1>{t('aboutTitle')}</h1>
      <section className="folder">
        <h2>{t('datasets')}</h2>
        {idx.state === 'loading' && <Loading />}
        {idx.state === 'unavailable' && <Unavailable what="index.json" />}
        {idx.state === 'ok' && (
          <>
            <p className="note">
              {t('earthdataLogin')}: <strong>{idx.data.earthdata_login ? t('statusOk') : t('statusUnavailable')}</strong>
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('colCase')}</th><th>{t('colName')}</th><th>{t('colVariable')}</th><th>{t('colVersion')}</th><th>{t('colStatus')}</th><th>{t('colNote')}</th>
                  </tr>
                </thead>
                <tbody>
                  {idx.data.sources.map((s) => (
                    <tr key={s.key}>
                      <td>{s.case}</td>
                      <td className="mono">{s.short_name}<br /><small>{s.daac}{s.doi ? <> · <a href={`https://doi.org/${s.doi}`} target="_blank" rel="noreferrer">doi</a></> : null}</small></td>
                      <td className="mono">{s.variable}</td>
                      <td>{s.version}</td>
                      <td><span className={`pill ${s.status}`}>{t(STATUS_KEY[s.status] ?? 'statusUnavailable')}</span></td>
                      <td><small>{s.note}</small></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="note">{t('builtAt')}: {idx.data.built_at}</p>
          </>
        )}
      </section>
      <section className="folder"><h2>{t('methods')}</h2><p>{t('methodsText')}</p></section>
      <section className="folder"><h2>{t('team')}</h2><p>{t('teamPlaceholder')}</p></section>
      <section className="folder"><h2>{t('useOfAi')}</h2><p>{t('useOfAiText')}</p></section>
    </>
  )
}
