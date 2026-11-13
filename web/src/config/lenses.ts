/**
 * "Who are you?" lenses. Each is a list of metrics with its own plain-language labels.
 * Adding a lens is a config change only: add an entry here.
 */

export interface LensMetric {
  metric: string
  /** Short card title, e.g. "Too hot to play". */
  title: string
  /** Phrase completing "N more/fewer ___, every year", e.g. "days too hot to play outside". */
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
      { metric: 'hot_days', title: 'Too hot to play outside', phrase: 'days too hot to play outside', moreIsBad: true },
      { metric: 'hot_nights', title: 'Too hot to sleep', phrase: 'nights too hot to sleep', moreIsBad: true },
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
      { metric: 'hot_days', title: 'Hot days (local)', phrase: 'locally hot days', moreIsBad: true },
      { metric: 'heatwave_days', title: 'Heatwave days', phrase: 'heatwave days', moreIsBad: true },
      { metric: 'sticky_days', title: 'Sticky, muggy days', phrase: 'sticky days', moreIsBad: true },
    ],
    caveat: 'These counts are a weather proxy for heat stress, not a workplace safety standard. They say nothing about shade, workload, clothing or breaks.',
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
      { metric: 'hot_days', title: 'Too hot to run', phrase: 'days too hot to run', moreIsBad: true },
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
      { metric: 'hot_nights', title: 'Nights too hot to sleep', phrase: 'nights too hot to sleep', moreIsBad: true },
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

export const LENS_BY_ID: Record<string, Lens> = Object.fromEntries(LENSES.map((l) => [l.id, l]))
