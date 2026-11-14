import { BASELINE, MAX_MISSING_FRACTION, METRICS, PARAM_INFO, PARAMS, THRESHOLDS, YEARS } from '../config/metrics'
// BASELINE and THRESHOLDS are used in the "Details for the curious" fold
import type { Lens } from '../config/lenses'
import type { CityAnalysis } from '../metrics'
import type { DailySeries } from '../power'
import { fmtNum, fmtSigned } from '../format'
import gistemp from '../data/gistemp.json'
import { FUTURE_BIRTH_YEAR, PACE_LINE, PACE_SOURCE } from '../config/context'
import { annualTrend } from '../stats'

const gistempTrend = annualTrend(gistemp.years, gistemp.values)

export function GlobalContext({ a, cityName }: { a: CityAnalysis; cityName: string }) {
  const city = a.results.mean_temp
  if (!city?.trend || !gistempTrend) return null
  const c = city.slopePerDecade!
  const g = gistempTrend.slope * 10
  const ratio = g > 0 ? c / g : null
  let words: string
  if (!city.trend.significant) words = `${cityName} has not warmed in a way we can be sure of since ${YEARS.first}.`
  else if (ratio !== null && ratio >= 1.5) words = `${cityName} is warming about ${ratio.toFixed(1).replace(/\.0$/, '')} times faster than the world as a whole.`
  else if (ratio !== null && ratio >= 0.75) words = `${cityName} is warming at about the same pace as the world as a whole.`
  else words = `${cityName} is warming more slowly than the world as a whole.`
  return (
    <div className="globalline">
      <p>
        <strong>{words}</strong>{' '}
        <span className="muted small">
          Here: {fmtSigned(c, 1)} °C every ten years. World: {fmtSigned(g, 1)} °C (NASA GISTEMP).
        </span>
      </p>
      <p className="pace">
        {PACE_LINE}{' '}
        <a className="small" href={PACE_SOURCE.url}>
          ({PACE_SOURCE.label})
        </a>
      </p>
    </div>
  )
}

export function Methods({ a, d, lens, cityName }: { a: CityAnalysis; d: DailySeries; lens: Lens; cityName: string }) {
  const ids = new Set(lens.metrics.map((m) => m.metric))
  const used = METRICS.filter((m) => ids.has(m.id))
  const others = METRICS.filter((m) => !ids.has(m.id))
  const maxMissing = Math.max(0, ...Object.values(a.results).flatMap((r) => r.annual.missing))
  return (
    <details className="methods">
      <summary>How do we know?</summary>
      <div className="methods-body">
        <ul className="simple">
          <li>
            <strong>The weather</strong> comes from NASA: its daily weather record for this spot, every day since {YEARS.first}.
          </li>
          <li>
            <strong>“Hot” means hot for {cityName}.</strong> A hot day here is above {fmtNum(a.ctx.p90max, 0)} °C. A hot night stays above {fmtNum(a.ctx.p90min, 0)} °C.
          </li>
          <li>
            <strong>Real change</strong> means {YEARS.last - YEARS.first + 1} years in a row point the same way, and a standard scientific test says it is very unlikely to be luck.
          </li>
          <li>
            <strong>No clear change</strong> means some years go up, some go down, and 45 years show no steady direction.
          </li>
          <li>
            <strong>Born {FUTURE_BIRTH_YEAR}, if it keeps going</strong> stretches the straight trend line into the future. It is a “what if”, not a forecast, and only appears where the
            change is real.
          </li>
          <li>
            <strong>Keep in mind:</strong> this is NASA’s weather model, not a thermometer in your street. Heat is very reliable, rain less so.
          </li>
        </ul>
        <ul className="plaindefs">
          {used.map((m) => (
            <li key={m.id}>
              <strong>{m.name}:</strong> {m.plain ?? m.definition.split(/(?<=\.)\s/)[0]}
            </li>
          ))}
        </ul>

        <details className="details-more">
          <summary>Details for the curious</summary>
          <h5>Data</h5>
          <p>
            NASA POWER daily point API, point {d.lat.toFixed(3)}, {d.lon.toFixed(3)}; MERRA-2 grid cell 0.5° × 0.625°, local solar time. Sources reported by POWER:{' '}
            {d.header.sources?.join(', ') ?? 'MERRA2, POWER'}. {d.header.api ? `API ${d.header.api}. ` : ''}Only full calendar years {YEARS.first}–{YEARS.last}; {YEARS.last + 1} never enters a
            statistic. A year is dropped for a metric when more than {MAX_MISSING_FRACTION * 100}% of its days are missing.{' '}
            {maxMissing === 0 ? 'No days are missing for this city.' : `Worst year here: ${(maxMissing * 100).toFixed(1)}% of days missing.`} Leap days count like any other day.
          </p>
          <ul className="params">
            {PARAMS.map((p) => (
              <li key={p}>
                <code>{p}</code> {PARAM_INFO[p].name} ({PARAM_INFO[p].unit})
              </li>
            ))}
          </ul>
          <h5>Full definitions</h5>
          <p className="small">
            Local thresholds are the {THRESHOLDS.hotPercentile}th percentile of the {BASELINE.first}–{BASELINE.last} daily values, all days of the year pooled. ETCCDI codes are the WMO
            climate-extremes indices; “variant” means the same idea with a whole-year percentile.
          </p>
          <dl className="defs">
            {[...used, ...others].map((m) => (
              <div key={m.id}>
                <dt>
                  {m.name}
                  {m.etccdi && <span className="etccdi">ETCCDI {m.etccdi}</span>}
                </dt>
                <dd>{m.definition}</dd>
              </div>
            ))}
          </dl>
          <h5>Statistics</h5>
          <p>
            Annual series {YEARS.first}–{YEARS.last}. Trend test: Mann-Kendall with the Hamed and Rao (1998) variance correction for autocorrelation, two-sided, α = 0.05. Trend size: Sen’s slope
            (median of pairwise slopes) with a 95% confidence interval after Sen (1968). The browser implementation is tested against the Python packages <code>pymannkendall</code> and{' '}
            <code>scipy</code> on the same series. Tap any card to see the slope per decade, its confidence interval and the p-value.
          </p>
          <h5>Limits</h5>
          <ul>
            <li>MERRA-2 is a reanalysis: a model that assimilates satellite and ground observations. Temperature and humidity trends are robust; precipitation at a point is less certain.</li>
            <li>Two people born close together share years, so their difference looks smaller than the long-term trend.</li>
            <li>The outdoor-worker lens is a weather proxy, not an occupational safety standard.</li>
            <li>Reanalyses can show small artificial jumps when the satellites they assimilate change.</li>
            <li>Coastal cities may sit in a grid cell that is partly sea, which cools the absolute numbers.</li>
            <li>Forty-five years is long for temperature counts, short for rare events such as the biggest downpour.</li>
          </ul>
          <h5>Credits</h5>
          <ul>
            <li>
              NASA POWER Project, daily point API, MERRA-2 meteorology. <a href="https://power.larc.nasa.gov/docs/">Documentation</a>.
            </li>
            <li>
              NASA GPM IMERG satellite precipitation, through NASA POWER (UTC days, from 1998). Used only in “A second opinion on rain”, next to MERRA-2 rain for the same days.
            </li>
            <li>
              NASA GISS Surface Temperature Analysis (GISTEMP v4), global annual means. <a href="https://data.giss.nasa.gov/gistemp/">data.giss.nasa.gov/gistemp</a>.
            </li>
            <li>
              City list: <a href="https://www.geonames.org/">GeoNames</a>, cities over 100,000 people, <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.
            </li>
            <li>
              “Perfect outdoor days” follows the outdoor-days idea of Choi, Khalifa and Eltahir (2024), Journal of Climate,{' '}
              <a href="https://doi.org/10.1175/JCLI-D-23-0346.1">doi:10.1175/JCLI-D-23-0346.1</a>. Our thresholds are our own.
            </li>
            <li>Hamed and Rao (1998), Journal of Hydrology 204. Sen (1968), JASA 63.</li>
          </ul>
        </details>
      </div>
    </details>
  )
}
