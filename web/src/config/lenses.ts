/**
 * "Who are you?" lenses. Each is a list of metrics with its own plain-language labels.
 * Adding a lens is a config change only: add an entry here.
 */

export interface LensMetric {
  metric: string
  /** Short card title, e.g. "Unusually hot days". Must not claim more than the metric measures. */
  title: string
  /** Phrase completing "N more/fewer ___, every year", e.g. "unusually hot days". */
  phrase: string
  /** Phrase for the biggest-downpour style metrics (unit mm): "mm in the biggest downpour". */
  moreIsBad: boolean
}

export interface Lens {
  id: string
  label: string
  emoji: string
  /** Who the two cards are: "A kid born in", "An outdoor worker in" ... */
  subject: string
  intro: string
  metrics: LensMetric[]
  /** Shown under the cards. */
  caveat?: string
  /** Show the month-by-month outdoor calendar. */
  calendar?: boolean
}

export const LENSES: Lens[] = [
  {
    id: 'kid',
    label: 'Kid / parent',
    emoji: '🧒',
    subject: 'A kid born in',
    intro: 'Same city. Same age. A different childhood.',
    metrics: [
      { metric: 'hot_days', title: 'Unusually hot days', phrase: 'unusually hot days', moreIsBad: true },
      { metric: 'hot_nights', title: 'Unusually warm nights', phrase: 'unusually warm nights', moreIsBad: true },
      { metric: 'rainy_days', title: 'Rainy days', phrase: 'rainy days', moreIsBad: false },
      { metric: 'sticky_days', title: 'Sticky, muggy days', phrase: 'sticky days', moreIsBad: true },
      { metric: 'perfect_days', title: 'Perfect play days', phrase: 'perfect play days', moreIsBad: false },
    ],
    calendar: true,
  },
  {
    id: 'worker',
    label: 'Outdoor worker',
    emoji: '👷',
    subject: 'An outdoor worker starting in',
    intro: 'Same job. Same city. Different working days.',
    metrics: [
      { metric: 'very_hot_days', title: 'Very hot workdays (35 °C+)', phrase: 'very hot workdays', moreIsBad: true },
      { metric: 'hot_days', title: 'Unusually hot days', phrase: 'unusually hot days', moreIsBad: true },
      { metric: 'heatwave_days', title: 'Heatwave days', phrase: 'heatwave days', moreIsBad: true },
      { metric: 'sticky_days', title: 'Sticky, muggy days', phrase: 'sticky days', moreIsBad: true },
    ],
    caveat: 'Weather only. This is not a workplace safety standard.',
  },
  {
    id: 'farmer',
    label: 'Farmer / gardener',
    emoji: '🌱',
    subject: 'A farmer starting out in',
    intro: 'Same fields. Different rain.',
    metrics: [
      { metric: 'longest_dry_spell', title: 'Longest dry spell', phrase: 'days in the longest dry spell', moreIsBad: true },
      { metric: 'heavy_rain_days', title: 'Heavy rain days (10 mm+)', phrase: 'heavy rain days', moreIsBad: true },
      { metric: 'biggest_downpour', title: 'Biggest downpour', phrase: 'mm in the biggest downpour', moreIsBad: true },
      { metric: 'frost_days', title: 'Frost days', phrase: 'frost days', moreIsBad: true },
      { metric: 'rainy_days', title: 'Rainy days', phrase: 'rainy days', moreIsBad: false },
    ],
  },
  {
    id: 'runner',
    label: 'Runner / athlete',
    emoji: '🏃',
    subject: 'A runner who started in',
    intro: 'Same route. Different training calendar.',
    metrics: [
      { metric: 'training_days', title: 'Good training days', phrase: 'good training days', moreIsBad: false },
      { metric: 'hot_days', title: 'Unusually hot days', phrase: 'unusually hot days', moreIsBad: true },
      { metric: 'sticky_days', title: 'Sticky, muggy days', phrase: 'sticky days', moreIsBad: true },
    ],
    calendar: true,
  },
  {
    id: 'older',
    label: 'Older person',
    emoji: '🧓',
    subject: 'An older person living here from',
    intro: 'Same home. Different summers.',
    metrics: [
      { metric: 'hot_nights', title: 'Unusually warm nights', phrase: 'unusually warm nights', moreIsBad: true },
      { metric: 'tropical_nights', title: 'Tropical nights (20 °C+)', phrase: 'tropical nights', moreIsBad: true },
      { metric: 'heatwave_days', title: 'Heatwave days', phrase: 'heatwave days', moreIsBad: true },
      { metric: 'very_hot_days', title: 'Very hot days (35 °C+)', phrase: 'very hot days', moreIsBad: true },
    ],
  },
  {
    id: 'traveller',
    label: 'Traveller / event planner',
    emoji: '🧳',
    subject: 'A visitor planning for',
    intro: 'Same destination. Different best months.',
    metrics: [
      { metric: 'perfect_days', title: 'Perfect outdoor days', phrase: 'perfect outdoor days', moreIsBad: false },
      { metric: 'rainy_days', title: 'Rainy days', phrase: 'rainy days', moreIsBad: true },
      { metric: 'very_hot_days', title: 'Very hot days (35 °C+)', phrase: 'very hot days', moreIsBad: true },
    ],
    calendar: true,
  },
]

// ---------- "Choose your own": the visitor picks the measures ----------

export const CUSTOM_LENS_ID = 'custom'
/** What the custom lens shows until the visitor changes it: the two basics and the two best-known counts. */
export const DEFAULT_PICK = ['mean_temp', 'rain_total', 'hot_days', 'rainy_days']

/** Neutral wording for every measure, used when the visitor builds their own list. Also the order they are shown in. */
export const CUSTOM_WORDS: Record<string, Omit<LensMetric, 'metric'>> = {
  mean_temp: { title: 'Average temperature', phrase: '°C on average', moreIsBad: true },
  mean_tmax: { title: 'Average daytime high', phrase: '°C in the daytime highs', moreIsBad: true },
  mean_tmin: { title: 'Average night-time low', phrase: '°C in the night-time lows', moreIsBad: true },
  rain_total: { title: 'Rain in the year', phrase: 'mm rain over the year', moreIsBad: false },
  hot_days: { title: 'Unusually hot days', phrase: 'unusually hot days', moreIsBad: true },
  very_hot_days: { title: 'Very hot days (35 °C+)', phrase: 'very hot days', moreIsBad: true },
  hot_nights: { title: 'Unusually warm nights', phrase: 'unusually warm nights', moreIsBad: true },
  tropical_nights: { title: 'Tropical nights (20 °C+)', phrase: 'tropical nights', moreIsBad: true },
  heatwave_days: { title: 'Heatwave days', phrase: 'heatwave days', moreIsBad: true },
  frost_days: { title: 'Frost days', phrase: 'frost days', moreIsBad: true },
  rainy_days: { title: 'Rainy days', phrase: 'rainy days', moreIsBad: false },
  heavy_rain_days: { title: 'Heavy rain days (10 mm+)', phrase: 'heavy rain days', moreIsBad: true },
  biggest_downpour: { title: 'Biggest downpour', phrase: 'mm in the biggest downpour', moreIsBad: true },
  longest_dry_spell: { title: 'Longest dry spell', phrase: 'days in the longest dry spell', moreIsBad: true },
  sticky_days: { title: 'Sticky, muggy days', phrase: 'sticky days', moreIsBad: true },
  perfect_days: { title: 'Perfect outdoor days', phrase: 'perfect outdoor days', moreIsBad: false },
  training_days: { title: 'Good training days', phrase: 'good training days', moreIsBad: false },
}

const CUSTOM_ORDER = Object.keys(CUSTOM_WORDS)

/** Known ids only, no repeats, in a fixed order (basics first); the default list when nothing valid is left. */
export function cleanPick(pick: string[]): string[] {
  const wanted = new Set(pick)
  const out = CUSTOM_ORDER.filter((id) => wanted.has(id))
  return out.length ? out : [...DEFAULT_PICK]
}

function customMetrics(pick: string[]): LensMetric[] {
  return cleanPick(pick).map((id) => ({ metric: id, ...CUSTOM_WORDS[id] }))
}

const CUSTOM_LENS: Lens = {
  id: CUSTOM_LENS_ID,
  label: 'Choose your own',
  emoji: '🔎',
  subject: 'Someone living here from',
  intro: 'You chose the measures. Same city, different years.',
  metrics: customMetrics(DEFAULT_PICK),
  calendar: true,
}
LENSES.push(CUSTOM_LENS)

/** The custom lens with the visitor's own list of measures. */
export function customLens(pick: string[]): Lens {
  return { ...CUSTOM_LENS, metrics: customMetrics(pick) }
}

export const LENS_BY_ID: Record<string, Lens> = Object.fromEntries(LENSES.map((l) => [l.id, l]))

/** The lens for a query: a ready-made one, or the visitor's own list. */
export function lensFor(lensId: string, pick: string[]): Lens {
  return lensId === CUSTOM_LENS_ID ? customLens(pick) : LENS_BY_ID[lensId]
}
