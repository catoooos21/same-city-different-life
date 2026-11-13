import { BASELINE, MAX_MISSING_FRACTION, METRICS, PARAM_INFO, PARAMS, THRESHOLDS, YEARS } from '../config/metrics'
import type { Lens } from '../config/lenses'
import type { CityAnalysis } from '../metrics'
import type { DailySeries } from '../power'
import { fmtNum, fmtSigned } from '../format'
import gistemp from '../data/gistemp.json'
import { annualTrend } from '../stats'

const gistempTrend = annualTrend(gistemp.years, gistemp.values)

export function GlobalContext({ a, cityName }: { a: CityAnalysis; cityName: string }) {
  const city = a.results.mean_temp
  if (!city?.trend || !gistempTrend) return null
  return (
    <p className="globalline">
      <strong>{cityName}</strong> warmed {fmtSigned(city.slopePerDecade, 2)} °C per decade since {YEARS.first} (95% CI {fmtSigned(city.ciPerDecade![0], 2)} to{' '}
      {fmtSigned(city.ciPerDecade![1], 2)}). The world as a whole: {fmtSigned(gistempTrend.slope * 10, 2)} °C per decade (NASA GISTEMP v4).
    </p>
  )
}

export function Methods({ a, d, lens, cityName }: { a: CityAnalysis; d: DailySeries; lens: Lens; cityName: string }) {
  const ids = new Set(lens.metrics.map((m) => m.metric))
  const used = METRICS.filter((m) => ids.has(m.id))
  const others = METRICS.filter((m) => !ids.has(m.id) && m.id !== 'mean_temp')
  const maxMissing = Math.max(0, ...Object.values(a.results).flatMap((r) => r.annual.missing))
  return (
    <details className="methods">
      <summary>How do we know?</summary>
      <div className="methods-body">
        <h4>Where the numbers come from</h4>
        <p>
          Daily weather for the point {d.lat.toFixed(3)}, {d.lon.toFixed(3)} from the <a href="https://power.larc.nasa.gov/">NASA POWER</a> daily API. POWER serves NASA’s{' '}
          <a href="https://gmao.gsfc.nasa.gov/reanalysis/MERRA-2/">MERRA-2</a> reanalysis, a global model run by the Global Modeling and Assimilation Office that assimilates satellite and ground
          observations. Values are for the MERRA-2 grid cell (about 0.5° × 0.625°, roughly 50 km) containing the point, in local solar time. Sources reported by POWER for this request:{' '}
          {d.header.sources?.join(', ') ?? 'MERRA2, POWER'}. {d.header.api ? `API ${d.header.api}. ` : ''}The app asks POWER directly from your browser; nothing is pre-computed except the
          four demo cities.
        </p>
        <ul className="params">
          {PARAMS.map((p) => (
            <li key={p}>
              <code>{p}</code> {PARAM_INFO[p].name} ({PARAM_INFO[p].unit})
            </li>
          ))}
        </ul>
        <p>
          Only full calendar years {YEARS.first}–{YEARS.last} are used; {YEARS.last + 1} never enters a statistic. A year is dropped for a metric when more than {MAX_MISSING_FRACTION * 100}% of its
          days are missing. {maxMissing === 0 ? 'No days are missing for this city.' : `Worst year here: ${(maxMissing * 100).toFixed(1)}% of days missing.`} Leap days are counted like any other day.
        </p>

        <h4>What each number means here</h4>
        <p>
          Local thresholds use this city’s own {BASELINE.first}–{BASELINE.last} baseline: the {THRESHOLDS.hotPercentile}th percentile of daily maxima is <strong>{fmtNum(a.ctx.p90max, 1)} °C</strong>{' '}
          and of daily minima <strong>{fmtNum(a.ctx.p90min, 1)} °C</strong>, so “hot” means hot for {cityName}.
        </p>
        <dl className="defs">
          {used.map((m) => (
            <div key={m.id}>
              <dt>
                {m.name}
                {m.etccdi && <span className="etccdi">ETCCDI {m.etccdi}</span>}
              </dt>
              <dd>{m.definition}</dd>
            </div>
          ))}
        </dl>
        <details>
          <summary>Other metrics used by other lenses</summary>
          <dl className="defs">
            {others.map((m) => (
              <div key={m.id}>
                <dt>
                  {m.name}
                  {m.etccdi && <span className="etccdi">ETCCDI {m.etccdi}</span>}
                </dt>
                <dd>{m.definition}</dd>
              </div>
            ))}
          </dl>
        </details>
        <p>
          ETCCDI are the standard climate-extremes indices of the WMO Expert Team on Climate Change Detection and Indices. Where a metric matches one, the code is shown; “variant” means the
          same idea with a simpler, whole-year percentile.
        </p>

        <h4>The statistics</h4>
        <p>
          For every metric we build one value per year, {YEARS.first}–{YEARS.last} ({YEARS.last - YEARS.first + 1} years). <strong>“Real change”</strong> means the Mann-Kendall trend test, with
          the Hamed and Rao (1998) correction for autocorrelation, gives p &lt; 0.05. <strong>“Can’t tell”</strong> means it does not: there may still be a trend, but the year-to-year variation
          is too large to be sure from this record. The size of the trend is Sen’s slope (the median of all pairwise slopes), shown per decade with a 95% confidence interval. “Then” and “Now”
          are plain averages of the yearly values in each period, and the difference is simply Now minus Then. The JavaScript implementation is tested against the Python packages{' '}
          <code>pymannkendall</code> and <code>scipy</code> on the same series.
        </p>

        <h4>Limits</h4>
        <ul>
          <li>MERRA-2 is a model, not a thermometer. It is excellent for trends in temperature and humidity; precipitation at a single point is less certain, even in the bias-corrected product we use.</li>
          <li>One grid cell of about 50 km represents the whole city. Coastal cities may sit in a cell that is partly sea, which cools the numbers; the trend is still the trend of that place.</li>
          <li>Reanalyses can show small artificial jumps when the satellites they assimilate change. Forty-five years is long enough for robust trends in temperature counts, shorter for rare events.</li>
          <li>A childhood is ten calendar years from the birth year. Two kids ten years apart can share years, which makes their difference smaller, not larger.</li>
          <li>The outdoor-worker lens is a weather proxy, not an occupational safety standard.</li>
        </ul>

        <h4>Credits</h4>
        <ul>
          <li>
            NASA POWER Project, daily point API, MERRA-2 meteorology. <a href="https://power.larc.nasa.gov/docs/">Documentation</a>.
          </li>
          <li>
            NASA GISS Surface Temperature Analysis (GISTEMP v4), global land-ocean annual means, for the “vs the world” line. <a href="https://data.giss.nasa.gov/gistemp/">data.giss.nasa.gov/gistemp</a>.
          </li>
          <li>
            City list: <a href="https://www.geonames.org/">GeoNames</a> cities with population over 100,000, licensed <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.
          </li>
          <li>
            “Perfect outdoor days” follows the idea of outdoor days in Choi, Y.-W., Khalifa, M. and Eltahir, E. A. B. (2024), “North–South disparity in impact of climate change on ‘outdoor
            days’”, Journal of Climate, <a href="https://doi.org/10.1175/JCLI-D-23-0346.1">doi:10.1175/JCLI-D-23-0346.1</a>. Our thresholds are our own.
          </li>
          <li>Hamed, K. H. and Rao, A. R. (1998), “A modified Mann-Kendall trend test for autocorrelated data”, Journal of Hydrology 204. Sen, P. K. (1968), JASA 63.</li>
        </ul>
      </div>
    </details>
  )
}
