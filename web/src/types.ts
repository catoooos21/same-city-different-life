// Mirrors docs/data_contract.md. Numbers may be null.
export type Num = number | null

export interface SourceStatus {
  key: string
  id: string
  short_name: string
  version: string
  variable: string
  daac: string
  doi: string
  role: string
  case: string
  status: 'ok' | 'fallback' | 'unavailable'
  note: string
}
export interface RegionInfo {
  id: string
  name: string
  name_ar?: string
}
export interface CaseSummary {
  id: string
  title: string
  title_ar?: string
  question: string
  question_ar?: string
  status: 'ok' | 'data_unavailable'
  regions: string[]
  variables?: { id: string; label: string; label_ar?: string; primary: boolean }[]
  maps?: string[]
  error?: string
}
export interface IndexFile {
  built_at: string
  earthdata_login: boolean
  cases: CaseSummary[]
  regions: { land: RegionInfo[]; sea: RegionInfo[] }
  sources: SourceStatus[]
}

export interface Trend {
  n: Num
  slope_per_year: Num
  slope_per_decade: Num
  ci95_per_decade: [Num, Num] | null
  total_change: Num
  pct_change_vs_baseline: Num
  p_value: Num
  z: Num
  tau: Num
  intercept: Num
  test: string
  verdict: string
  significant: boolean
}
export interface SeasonalKendall {
  n_months: Num
  slope_per_decade: Num
  p_value: Num
  test: string
  verdict: string
  significant: boolean
}
export interface PerMonthTrend {
  slope_per_decade: Num
  p_value: Num
  significant: boolean
  n: Num
}
export interface VariableSource {
  short_name: string
  version: string
  variable: string
  daac: string
  doi: string
  access: 'earthdata' | 'power_fallback'
  fallback_note?: string
  fallback_source?: string
}
export interface Variable {
  id: string
  label: string
  label_ar?: string
  unit: string
  description?: string
  primary: boolean
  log10: boolean
  source: VariableSource
  n_cells: number
  has_map: boolean
  annual: { years: number[]; values: Num[] }
  annual_anomaly: { years: number[]; values: Num[] }
  monthly: { dates: string[]; values: Num[] }
  monthly_anomaly: { dates: string[]; values: Num[] }
  climatology: Num[]
  baseline_mean: Num
  heat_strip: { years: number[]; months: number[]; values: Num[][] }
  trend: Trend | null
  seasonal_kendall: SeasonalKendall | null
  per_month_trends: Record<string, PerMonthTrend | null>
  preview_2026?: { dates: string[]; values: Num[]; anomaly: Num[] }
}
export interface GlobalComparison {
  source: string
  url: string
  note: string
  years: number[]
  anomaly: Num[]
  trend: Trend | null
  kuwait_slope_per_decade: Num
  ratio_kuwait_to_global: Num
}
export interface Verdict {
  headline: 'Significant increase' | 'Significant decrease' | 'No significant trend' | string
  headline_ar?: string
  stamp: 'CASE CLOSED' | 'INCONCLUSIVE'
  what: string
  where: string
  how_much: string
  significant: string
  what_ar?: string
  where_ar?: string
  how_much_ar?: string
  text: string
  text_ar?: string
}
export interface CaseFile {
  case: string
  title: string
  title_ar?: string
  question: string
  question_ar?: string
  region: { id: string; name: string; name_ar?: string; kind: 'land' | 'sea' }
  period: { start: number; end: number; baseline: [number, number] }
  variables: Variable[]
  comparison?: { global?: GlobalComparison }
  verdict: Verdict
  evidence: string[]
  limitations: string[]
  limitations_ar?: string[]
}
export interface MapGrid {
  case: string
  variable: string
  label: string
  unit_per_decade: string
  lon: number[]
  lat: number[]
  slope_per_decade: Num[][]
  p_value: Num[][]
  significant: (boolean | null)[][]
  n: Num[][]
  fdr_q: Num
  log10: boolean
  n_cells: number
  n_significant: number
  n_sig_increase: number
  n_sig_decrease: number
  source: VariableSource
}
