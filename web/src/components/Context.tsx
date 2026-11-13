import { CONTEXT, GENERIC_CHOICES, GLOBAL_REASONS, type Era } from '../config/context'
import type { Period } from '../metrics'

function overlaps(e: Era, p: Period): boolean {
  return e.from <= p.last && e.to >= p.first
}

export function WhyPanel({ country, cityName, then, now }: { country: string; cityName: string; then: Period; now: Period }) {
  const c = CONTEXT[country]
  const thenEras = c ? c.eras.filter((e) => overlaps(e, then)) : []
  const nowEras = c ? c.eras.filter((e) => overlaps(e, now) && !thenEras.includes(e)) : []
  const choices = c?.choices ?? GENERIC_CHOICES
  return (
    <section className="why">
      <h3>Why might this be?</h3>
      <p className="muted small">The NASA data shows that it changed. What follows is context from history and research, not something the data can prove.</p>

      <h4>The usual reasons, everywhere</h4>
      <ul className="simple">
        {GLOBAL_REASONS.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>

      {c && (thenEras.length > 0 || nowEras.length > 0) && (
        <>
          <h4>What {country} was going through</h4>
          <div className="clippings">
            {thenEras.map((e) => (
              <Clipping key={e.title} e={e} side="then" />
            ))}
            {nowEras.map((e) => (
              <Clipping key={e.title} e={e} side="now" />
            ))}
          </div>
        </>
      )}

      <h4>Life choices that add heat {c ? `in ${country}` : `in a city like ${cityName}`}</h4>
      <ul className="simple">
        {choices.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      {c?.sources && (
        <p className="muted small">
          Sources:{' '}
          {c.sources.map((s, i) => (
            <span key={s.url}>
              {i > 0 && ' · '}
              <a href={s.url}>{s.label}</a>
            </span>
          ))}
        </p>
      )}
    </section>
  )
}

function Clipping({ e, side }: { e: Era; side: 'then' | 'now' }) {
  return (
    <article className={`clipping ${side}`}>
      <span className="years">
        {e.from}–{e.to}
      </span>
      <strong>{e.title}</strong>
      <p>{e.text}</p>
    </article>
  )
}
