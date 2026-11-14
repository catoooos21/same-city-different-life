import { CASE_GROUPS } from '../casefile'
import { METRICS, METRIC_BY_ID } from '../config/metrics'
import { CUSTOM_WORDS, cleanPick } from '../config/lenses'

/** The same groups the case file uses, with the basics first. */
const GROUPS: { title: string; ids: string[] }[] = [
  { title: 'The basics', ids: METRICS.filter((m) => m.basic).map((m) => m.id) },
  ...CASE_GROUPS.map((g) => ({ title: g.title, ids: g.metrics })),
]

/**
 * "Choose your own": tick the measures the scrapbooks should show.
 * At least one always stays ticked, so the page never ends up empty.
 */
export function MeasurePicker({ value, onChange }: { value: string[]; onChange: (pick: string[]) => void }) {
  const on = new Set(value)
  const toggle = (id: string) => {
    const next = new Set(on)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    if (next.size > 0) onChange(cleanPick([...next]))
  }
  return (
    <div className="measurepicker">
      <p className="muted small">
        Tick the measures you want to investigate. {value.length} chosen{value.length === 1 ? ' (one always stays on)' : ''}.
      </p>
      {GROUPS.map((g) => (
        <div className="pickgroup" key={g.title} role="group" aria-label={g.title}>
          <span className="picktitle">{g.title}</span>
          {g.ids
            .filter((id) => CUSTOM_WORDS[id] && METRIC_BY_ID[id])
            .map((id) => (
              <button key={id} type="button" role="checkbox" aria-checked={on.has(id)} className={`chip ${on.has(id) ? 'on' : ''}`} onClick={() => toggle(id)} title={METRIC_BY_ID[id].plain}>
                {on.has(id) ? '✓ ' : ''}
                {CUSTOM_WORDS[id].title}
              </button>
            ))}
        </div>
      ))}
    </div>
  )
}
