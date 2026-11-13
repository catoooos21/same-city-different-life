/**
 * Trend statistics, ported one-to-one from the Python reference used in `pipeline/stats.py`:
 *
 *  - Mann-Kendall test with the Hamed & Rao (1998) autocorrelation correction
 *    (port of pymannkendall.hamed_rao_modification_test, lag = n).
 *  - Sen's slope (median of pairwise slopes) with a 95 % confidence interval from
 *    Sen (1968) eq. 2.6 (port of scipy.stats.theilslopes, method='separate').
 *
 * `web/src/__tests__/stats.test.ts` checks this file against values produced by the Python
 * libraries on the same series, so the browser reports the same numbers the reference would.
 */

export const ALPHA = 0.05
export const MIN_YEARS = 10

export interface Trend {
  n: number
  s: number
  varS: number
  z: number
  tau: number
  p: number
  /** Sen's slope per unit of x (per year when x = years). */
  slope: number
  intercept: number
  /** 95 % confidence interval on the slope. */
  ci: [number, number]
  significant: boolean
  direction: 'up' | 'down' | 'none'
  /** True when the Hamed-Rao correction failed (non-finite variance) and the plain MK test was used. */
  fallback: boolean
}

// ---------- normal distribution ----------

/**
 * Complementary error function to near double precision:
 * Taylor series of erf for |x| < 2.5, Lentz continued fraction for erfc beyond.
 */
function erfc(x: number): number {
  const z = Math.abs(x)
  let r: number
  if (z < 2.5) {
    // erf(z) = 2/sqrt(pi) * sum_{n>=0} (-1)^n z^(2n+1) / (n! (2n+1))
    let term = z
    let sum = z
    const z2 = z * z
    for (let n = 1; n < 80; n++) {
      term *= -z2 / n
      const add = term / (2 * n + 1)
      sum += add
      if (Math.abs(add) < 1e-17 * Math.abs(sum)) break
    }
    r = 1 - (2 / Math.sqrt(Math.PI)) * sum
  } else {
    // erfc(z) = exp(-z^2)/sqrt(pi) * 1/(z + 1/2/(z + 1/(z + 3/2/(z + 2/(z + ...)))))  (modified Lentz)
    const tiny = 1e-300
    let f = z
    let C = z
    let D = 0
    for (let k = 1; k < 200; k++) {
      const a = k / 2
      D = z + a * D
      D = D === 0 ? tiny : D
      C = z + a / C
      C = C === 0 ? tiny : C
      D = 1 / D
      const delta = C * D
      f *= delta
      if (Math.abs(delta - 1) < 1e-16) break
    }
    r = Math.exp(-z * z) / Math.sqrt(Math.PI) / f
  }
  return x >= 0 ? r : 2 - r
}

export function normCdf(x: number): number {
  return 0.5 * erfc(-x / Math.SQRT2)
}

/** Inverse normal CDF (Acklam's algorithm with one Newton refinement step). */
export function normPpf(p: number): number {
  if (p <= 0) return -Infinity
  if (p >= 1) return Infinity
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239]
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1]
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416]
  const pl = 0.02425
  let x: number
  if (p < pl) {
    const q = Math.sqrt(-2 * Math.log(p))
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  } else if (p <= 1 - pl) {
    const q = p - 0.5
    const r = q * q
    x = ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p))
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
  // one step of Newton refinement
  const e = normCdf(x) - p
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2)
  x = x - u / (1 + (x * u) / 2)
  return x
}

// ---------- helpers ----------

function median(sorted: number[]): number {
  const n = sorted.length
  if (n === 0) return NaN
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2
}

function sortedCopy(a: number[]): number[] {
  return a.slice().sort((p, q) => p - q)
}

/** Average ranks (scipy.stats.rankdata, method='average'). */
export function rankdata(x: number[]): number[] {
  const n = x.length
  const idx = x.map((_, i) => i).sort((i, j) => x[i] - x[j])
  const ranks = new Array<number>(n)
  let i = 0
  while (i < n) {
    let j = i
    while (j + 1 < n && x[idx[j + 1]] === x[idx[i]]) j++
    const r = (i + j + 2) / 2 // average of 1-based ranks i+1..j+1
    for (let k = i; k <= j; k++) ranks[idx[k]] = r
    i = j + 1
  }
  return ranks
}

/** Sizes of tie groups (scipy _find_repeats: groups with >= 2 members). */
function tieGroupSizes(x: number[]): number[] {
  const s = sortedCopy(x)
  const out: number[] = []
  let i = 0
  while (i < s.length) {
    let j = i
    while (j + 1 < s.length && s[j + 1] === s[i]) j++
    if (j > i) out.push(j - i + 1)
    i = j + 1
  }
  return out
}

function mkScore(x: number[]): number {
  let s = 0
  const n = x.length
  for (let k = 0; k < n - 1; k++) for (let j = k + 1; j < n; j++) s += x[j] > x[k] ? 1 : x[j] < x[k] ? -1 : 0
  return s
}

function varianceS(x: number[]): number {
  const n = x.length
  let ties = 0
  for (const t of tieGroupSizes(x)) ties += t * (t - 1) * (2 * t + 5)
  return (n * (n - 1) * (2 * n + 5) - ties) / 18
}

function zScore(s: number, varS: number): number {
  if (s > 0) return (s - 1) / Math.sqrt(varS)
  if (s < 0) return (s + 1) / Math.sqrt(varS)
  return 0
}

/** Autocorrelation function as in pymannkendall.__acf (biased estimator, lags 0..nlags). */
function acf(x: number[], nlags: number): number[] {
  const n = x.length
  const mean = x.reduce((a, b) => a + b, 0) / n
  const y = x.map((v) => v - mean)
  const acov: number[] = []
  for (let lag = 0; lag <= nlags; lag++) {
    let s = 0
    for (let i = 0; i + lag < n; i++) s += y[i] * y[i + lag]
    acov.push(s / n)
  }
  return acov.map((v) => v / acov[0])
}

/** Sen's slope on an evenly spaced series (pymannkendall.sens_slope): median pairwise slope, Conover intercept. */
export function sensSlope(x: number[]): { slope: number; intercept: number } {
  const n = x.length
  const d: number[] = []
  for (let i = 0; i < n - 1; i++) for (let j = i + 1; j < n; j++) d.push((x[j] - x[i]) / (j - i))
  const slope = median(sortedCopy(d))
  const idx = Array.from({ length: n }, (_, i) => i)
  const intercept = median(sortedCopy(x)) - median(idx) * slope
  return { slope, intercept }
}

// ---------- the tests ----------

export interface MKResult {
  s: number
  varS: number
  z: number
  tau: number
  p: number
  h: boolean
}

/** Original Mann-Kendall test (pymannkendall.original_test). */
export function mannKendall(x: number[], alpha = ALPHA): MKResult {
  const n = x.length
  const s = mkScore(x)
  const varS = varianceS(x)
  const z = zScore(s, varS)
  const p = 2 * (1 - normCdf(Math.abs(z)))
  return { s, varS, z, tau: s / (0.5 * n * (n - 1)), p, h: Math.abs(z) > normPpf(1 - alpha / 2) }
}

/** Mann-Kendall with the Hamed & Rao (1998) variance correction (pymannkendall.hamed_rao_modification_test, lag=None). */
export function hamedRao(x: number[], alpha = ALPHA): MKResult {
  const n = x.length
  const s = mkScore(x)
  let varS = varianceS(x)
  const tau = s / (0.5 * n * (n - 1))
  const lag = n
  const { slope } = sensSlope(x)
  const detrended = x.map((v, i) => v - (i + 1) * slope)
  const ranks = rankdata(detrended)
  const r = acf(ranks, lag - 1)
  const bound = normPpf(1 - alpha / 2) / Math.sqrt(n)
  let sni = 0
  for (let i = 1; i < lag; i++) {
    if (r[i] <= bound && r[i] >= -bound) continue
    sni += (n - i) * (n - i - 1) * (n - i - 2) * r[i]
  }
  const nns = 1 + (2 / (n * (n - 1) * (n - 2))) * sni
  varS = varS * nns
  const z = zScore(s, varS)
  const p = 2 * (1 - normCdf(Math.abs(z)))
  return { s, varS, z, tau, p, h: Math.abs(z) > normPpf(1 - alpha / 2) }
}

/** Theil-Sen slope with confidence interval (scipy.stats.theilslopes, method='separate'). */
export function theilslopes(y: number[], x: number[], confidence = 0.95): { slope: number; intercept: number; low: number; high: number } {
  const slopes: number[] = []
  for (let i = 0; i < y.length; i++)
    for (let j = 0; j < y.length; j++) if (x[i] - x[j] > 0) slopes.push((y[i] - y[j]) / (x[i] - x[j]))
  slopes.sort((a, b) => a - b)
  const slope = median(slopes)
  const intercept = median(sortedCopy(y)) - slope * median(sortedCopy(x))
  let alpha = 1 - confidence
  if (alpha > 0.5) alpha = 1 - alpha
  const z = normPpf(alpha / 2)
  const ny = y.length
  let sigsq = ny * (ny - 1) * (2 * ny + 5)
  for (const k of tieGroupSizes(x)) sigsq -= k * (k - 1) * (2 * k + 5)
  for (const k of tieGroupSizes(y)) sigsq -= k * (k - 1) * (2 * k + 5)
  sigsq /= 18
  const nt = slopes.length
  const sigma = Math.sqrt(sigsq)
  // numpy rounds half to even
  const ru = Math.min(roundHalfEven((nt - z * sigma) / 2), slopes.length - 1)
  const rl = Math.max(roundHalfEven((nt + z * sigma) / 2) - 1, 0)
  return { slope, intercept, low: slopes[rl], high: slopes[ru] }
}

function roundHalfEven(v: number): number {
  const f = Math.floor(v)
  const diff = v - f
  if (diff > 0.5) return f + 1
  if (diff < 0.5) return f
  return f % 2 === 0 ? f : f + 1
}

/**
 * Full trend summary for an annual series. `values` may contain null/NaN (dropped years).
 * Returns null when fewer than MIN_YEARS valid years remain.
 */
export function annualTrend(years: number[], values: (number | null)[], alpha = ALPHA): Trend | null {
  const xs: number[] = []
  const ys: number[] = []
  for (let i = 0; i < years.length; i++) {
    const v = values[i]
    if (v !== null && v !== undefined && Number.isFinite(v)) {
      xs.push(years[i])
      ys.push(v)
    }
  }
  const n = ys.length
  if (n < MIN_YEARS) return null
  let mk = hamedRao(ys, alpha)
  let fallback = false
  if (!Number.isFinite(mk.p) || !Number.isFinite(mk.varS) || mk.varS <= 0) {
    mk = mannKendall(ys, alpha)
    fallback = true
  }
  const ts = theilslopes(ys, xs, 1 - alpha)
  const significant = mk.p < alpha && ts.slope !== 0
  return {
    n,
    s: mk.s,
    varS: mk.varS,
    z: mk.z,
    tau: mk.tau,
    p: mk.p,
    slope: ts.slope,
    intercept: ts.intercept,
    ci: [ts.low, ts.high],
    significant,
    direction: significant ? (ts.slope > 0 ? 'up' : 'down') : 'none',
    fallback,
  }
}

/** numpy.percentile default (linear interpolation) on finite values. */
export function percentile(values: ArrayLike<number>, q: number): number {
  const a: number[] = []
  for (let i = 0; i < values.length; i++) if (Number.isFinite(values[i])) a.push(values[i])
  a.sort((p, r) => p - r)
  if (a.length === 0) return NaN
  const pos = (q / 100) * (a.length - 1)
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return a[lo] + (a[hi] - a[lo]) * (pos - lo)
}
