/**
 * Every metric in the app is defined here, with its thresholds. The "How do we know?" panel
 * prints these definitions, so changing a number here changes both the computation and the text.
 *
 * Baseline for the local percentile thresholds: 1981-2010, computed per city, all days of the year.
 */

export type Param = 'T2M_MAX' | 'T2M_MIN' | 'T2M' | 'T2MDEW' | 'PRECTOTCORR' | 'RH2M'

export const PARAMS: Param[] = ['T2M_MAX', 'T2M_MIN', 'T2M', 'T2MDEW', 'PRECTOTCORR', 'RH2M']

export const PARAM_INFO: Record<Param, { name: string; unit: string }> = {
  T2M_MAX: { name: 'Daily maximum air temperature at 2 m', unit: '°C' },
  T2M_MIN: { name: 'Daily minimum air temperature at 2 m', unit: '°C' },
  T2M: { name: 'Daily mean air temperature at 2 m', unit: '°C' },
  T2MDEW: { name: 'Daily mean dew point at 2 m', unit: '°C' },
  PRECTOTCORR: { name: 'Daily precipitation (bias-corrected)', unit: 'mm/day' },
  RH2M: { name: 'Daily mean relative humidity at 2 m', unit: '%' },
}

export const YEARS = { first: 1981, last: 2025 }
export const BASELINE = { first: 1981, last: 2010 }
/** Drop a year for a metric if more than this fraction of its days is missing. */
export const MAX_MISSING_FRACTION = 0.1
/** Birth years allowed in childhood mode (ten years of data must exist). */
export const BIRTH_YEARS = { first: 1981, last: 2016 }
export const CHILDHOOD_LENGTH = 10

export const THRESHOLDS = {
  hotPercentile: 90,
  veryHotMaxC: 35,
  tropicalNightMinC: 20,
  frostMinC: 0,
  heatwaveRunDays: 3,
  rainyDayMm: 1,
  heavyRainMm: 10,
  stickyDewC: 20,
  perfect: { maxLow: 18, maxHigh: 30, rainBelowMm: 1, dewBelowC: 20 },
  training: { meanLow: 5, meanHigh: 20, rainBelowMm: 1, dewBelowC: 16 },
} as const

/** Per-city context computed from the baseline period. */
export interface CityContext {
  p90max: number
  p90min: number
}

/** One day's values, NaN where missing. */
export interface Day {
  T2M_MAX: number
  T2M_MIN: number
  T2M: number
  T2MDEW: number
  PRECTOTCORR: number
  RH2M: number
}

export type MetricKind =
  | { kind: 'count'; test: (d: Day, c: CityContext) => boolean }
  | { kind: 'max'; value: (d: Day) => number }
  | { kind: 'longest_run'; test: (d: Day, c: CityContext) => boolean }
  | { kind: 'run_days'; test: (d: Day, c: CityContext) => boolean; minRun: number }

export interface MetricDef {
  id: string
  /** Neutral name shown in the methods panel. */
  name: string
  /** One short everyday-words line for the simple panel. */
  plain?: string
  /** Unit of the annual value. */
  unit: 'days' | 'mm'
  /** Which POWER parameters a day needs; a day missing any of them is a missing day. */
  needs: Param[]
  definition: string
  etccdi?: string
  /** Only show this metric when the baseline average passes this test ("show only where it happens"). */
  showIf?: (baselineMean: number) => boolean
  /**
   * Built only on precipitation. MERRA-2 rain at a single point is less certain than temperature,
   * so a significant trend here gets a softer stamp and a caution line.
   */
  lessCertain?: boolean
  /** Monthly breakdown makes sense (outdoor calendar). */
  monthly?: boolean
  compute: MetricKind
}

const T = THRESHOLDS

export const METRICS: MetricDef[] = [
  {
    id: 'hot_days',
    name: 'Hot days',
    plain: 'Hotter than 9 days out of 10 were here in 1981–2010.',
    unit: 'days',
    needs: ['T2M_MAX'],
    definition: `Days whose maximum temperature is above this city's ${T.hotPercentile}th percentile of daily maxima over ${BASELINE.first}-${BASELINE.last} (all days of the year pooled, so this is a local "hot for here"). Related to ETCCDI TX90p, which uses a calendar-day percentile instead.`,
    etccdi: 'TX90p (variant)',
    compute: { kind: 'count', test: (d, c) => d.T2M_MAX > c.p90max },
  },
  {
    id: 'very_hot_days',
    name: 'Very hot days',
    plain: '35 °C or hotter.',
    unit: 'days',
    needs: ['T2M_MAX'],
    definition: `Days with a maximum temperature of ${T.veryHotMaxC} °C or more. Shown only where it happens (baseline average of at least one day a year).`,
    showIf: (m) => m >= 1,
    compute: { kind: 'count', test: (d) => d.T2M_MAX >= T.veryHotMaxC },
  },
  {
    id: 'hot_nights',
    name: 'Hot nights',
    plain: 'Warmer at night than 9 nights out of 10 were here in 1981–2010.',
    unit: 'days',
    needs: ['T2M_MIN'],
    definition: `Nights whose minimum temperature is above this city's ${T.hotPercentile}th percentile of daily minima over ${BASELINE.first}-${BASELINE.last}. Related to ETCCDI TN90p.`,
    etccdi: 'TN90p (variant)',
    compute: { kind: 'count', test: (d, c) => d.T2M_MIN > c.p90min },
  },
  {
    id: 'tropical_nights',
    name: 'Tropical nights',
    plain: 'The night never drops below 20 °C.',
    unit: 'days',
    needs: ['T2M_MIN'],
    definition: `Nights whose minimum temperature stays at ${T.tropicalNightMinC} °C or above. Shown only where it happens.`,
    etccdi: 'TR',
    showIf: (m) => m >= 1,
    compute: { kind: 'count', test: (d) => d.T2M_MIN >= T.tropicalNightMinC },
  },
  {
    id: 'heatwave_days',
    name: 'Heatwave days',
    plain: 'Three or more hot days in a row.',
    unit: 'days',
    needs: ['T2M_MAX'],
    definition: `Days inside a run of at least ${T.heatwaveRunDays} consecutive hot days (hot = above the local ${T.hotPercentile}th percentile). Runs may cross New Year, so southern-hemisphere summers are counted correctly; each day counts in its own year.`,
    compute: { kind: 'run_days', test: (d, c) => d.T2M_MAX > c.p90max, minRun: T.heatwaveRunDays },
  },
  {
    id: 'frost_days',
    name: 'Frost days',
    plain: 'Below 0 °C at night.',
    unit: 'days',
    needs: ['T2M_MIN'],
    definition: `Days whose minimum temperature is below ${T.frostMinC} °C. Shown only where it happens.`,
    etccdi: 'FD',
    showIf: (m) => m >= 1,
    compute: { kind: 'count', test: (d) => d.T2M_MIN < T.frostMinC },
  },
  {
    id: 'rainy_days',
    lessCertain: true,
    name: 'Rainy days',
    plain: 'At least 1 mm of rain.',
    unit: 'days',
    needs: ['PRECTOTCORR'],
    definition: `Days with at least ${T.rainyDayMm} mm of precipitation.`,
    etccdi: 'R1mm',
    compute: { kind: 'count', test: (d) => d.PRECTOTCORR >= T.rainyDayMm },
  },
  {
    id: 'heavy_rain_days',
    lessCertain: true,
    name: 'Heavy rain days',
    plain: 'At least 10 mm of rain.',
    unit: 'days',
    needs: ['PRECTOTCORR'],
    definition: `Days with at least ${T.heavyRainMm} mm of precipitation.`,
    etccdi: 'R10mm',
    compute: { kind: 'count', test: (d) => d.PRECTOTCORR >= T.heavyRainMm },
  },
  {
    id: 'biggest_downpour',
    lessCertain: true,
    name: 'Biggest downpour',
    plain: 'Rain on the wettest day of the year.',
    unit: 'mm',
    needs: ['PRECTOTCORR'],
    definition: 'Precipitation on the wettest day of the year, in mm.',
    etccdi: 'Rx1day',
    compute: { kind: 'max', value: (d) => d.PRECTOTCORR },
  },
  {
    id: 'longest_dry_spell',
    lessCertain: true,
    name: 'Longest dry spell',
    plain: 'Most days in a row without rain.',
    unit: 'days',
    needs: ['PRECTOTCORR'],
    definition: `Longest run of consecutive days with less than ${T.rainyDayMm} mm of precipitation within the calendar year.`,
    etccdi: 'CDD',
    compute: { kind: 'longest_run', test: (d) => d.PRECTOTCORR < T.rainyDayMm },
  },
  {
    id: 'sticky_days',
    name: 'Sticky days',
    plain: 'Muggy air: dew point 20 °C or more.',
    unit: 'days',
    needs: ['T2MDEW'],
    definition: `Days whose mean dew point is ${T.stickyDewC} °C or above (air that feels muggy).`,
    compute: { kind: 'count', test: (d) => d.T2MDEW >= T.stickyDewC },
  },
  {
    id: 'perfect_days',
    name: 'Perfect outdoor days',
    plain: '18–30 °C, dry, not muggy.',
    unit: 'days',
    needs: ['T2M_MAX', 'PRECTOTCORR', 'T2MDEW'],
    definition: `Days with a maximum temperature between ${T.perfect.maxLow} and ${T.perfect.maxHigh} °C, less than ${T.perfect.rainBelowMm} mm of precipitation and a dew point below ${T.perfect.dewBelowC} °C. Our own thresholds, inspired by the "outdoor days" idea of Choi, Khalifa and Eltahir (2024).`,
    monthly: true,
    compute: {
      kind: 'count',
      test: (d) => d.T2M_MAX >= T.perfect.maxLow && d.T2M_MAX <= T.perfect.maxHigh && d.PRECTOTCORR < T.perfect.rainBelowMm && d.T2MDEW < T.perfect.dewBelowC,
    },
  },
  {
    id: 'training_days',
    name: 'Good training days',
    plain: '5–20 °C, dry, not muggy.',
    unit: 'days',
    needs: ['T2M', 'PRECTOTCORR', 'T2MDEW'],
    definition: `Days with a mean temperature between ${T.training.meanLow} and ${T.training.meanHigh} °C, less than ${T.training.rainBelowMm} mm of precipitation and a dew point below ${T.training.dewBelowC} °C.`,
    monthly: true,
    compute: {
      kind: 'count',
      test: (d) => d.T2M >= T.training.meanLow && d.T2M <= T.training.meanHigh && d.PRECTOTCORR < T.training.rainBelowMm && d.T2MDEW < T.training.dewBelowC,
    },
  },
  {
    id: 'mean_temp',
    name: 'Mean temperature',
    unit: 'days', // not shown as a card; used for the "vs the world" comparison (°C)
    needs: ['T2M'],
    definition: 'Annual mean of the daily mean temperature, °C. Used only to compare this city with the global GISTEMP record.',
    compute: { kind: 'max', value: (d) => d.T2M }, // placeholder kind; handled specially in metrics.ts
  },
]

export const METRIC_BY_ID: Record<string, MetricDef> = Object.fromEntries(METRICS.map((m) => [m.id, m]))
