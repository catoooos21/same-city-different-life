/**
 * Country board, ACTION side: what a country has pledged or passed. This is CONTEXT written by
 * the team from public sources, not NASA data, and the board says so. It is never presented as
 * the cause of a weather change: a country's rules cannot cool its own weather, because the air
 * is shared and warming follows what the whole world burns.
 *
 * The grouping uses one plain yardstick so it is not our opinion: when did the country first set
 * a national net-zero target?
 *   long   = by 2019            -> "Acting for years"
 *   recent = 2020 or later      -> "Started recently"
 *   none   = no net-zero target -> "No net-zero target yet"
 *
 * Add a country by adding an entry keyed by its name in the city list (GeoNames English name).
 * Please check every fact against its source before presenting.
 */

export type ActionStage = 'long' | 'recent' | 'none'

export const STAGE_LABEL: Record<ActionStage, string> = {
  long: 'Acting for years',
  recent: 'Started recently',
  none: 'No net-zero target yet',
}

export const STAGE_RULE: Record<ActionStage, string> = {
  long: 'First national net-zero target set in 2019 or earlier.',
  recent: 'First national net-zero target set in 2020 or later.',
  none: 'No national net-zero target so far.',
}

export interface CountryAction {
  stage: ActionStage
  /** One line: the target and when it was set. */
  target: string
  /** The reasons: rules and steps, in plain words. */
  steps: string[]
  /** A caution shown under the weather stamp when the data needs explaining. */
  dataNote?: string
  sources: { label: string; url: string }[]
}

const NET_ZERO_TRACKER = { label: 'Net Zero Tracker', url: 'https://zerotracker.net/' }
const GCC_MEI = { label: 'Middle East Institute: The GCC and the road to net zero', url: 'https://mei.edu/publications/gcc-and-road-net-zero' }
const GCC_ORF = { label: 'ORF: Energy transitions in the Gulf (2025)', url: 'https://www.orfonline.org/research/energy-transitions-in-the-gulf-realities-risks-and-the-road-ahead' }
const CCN_2019 = { label: 'Climate Home News: which countries have a net-zero goal (2019)', url: 'https://climatechangenews.com/2019/06/14/countries-net-zero-climate-goal/' }
const NS_ENERGY = { label: 'NS Energy: countries with net-zero targets', url: 'https://www.nsenergybusiness.com/analysis/countries-net-zero-emissions/' }

export const ACTIONS: Record<string, CountryAction> = {
  'United Arab Emirates': {
    stage: 'recent',
    target: 'Net zero by 2050, pledged in 2021: the first country in the Middle East and North Africa to do so.',
    steps: [
      'A national climate law (Federal Decree-Law No. 11 of 2024) came into force on 30 May 2025. Every company, including those in free zones, must measure and report its emissions and plan to cut them.',
      'Hosted the COP28 climate summit in Dubai in 2023.',
      'Outdoor work in direct sun is banned around midday every summer, to protect workers from the heat.',
    ],
    sources: [
      { label: 'The National: UAE climate law comes into force (June 2025)', url: 'https://www.thenationalnews.com/news/uae/2025/06/02/landmark-uae-climate-law-aims-to-curb-emissions-and-boost-net-zero-ambitions' },
      { label: 'PwC: UAE Climate Change Law', url: 'https://www.pwc.com/m1/en/services/assurance/manage-risk-in-business/uae-climate-change-law.html' },
      GCC_MEI,
    ],
  },
  'Saudi Arabia': {
    stage: 'recent',
    target: 'Net zero by 2060, announced in October 2021 at the first Saudi Green Initiative Forum.',
    steps: ['The Saudi Green Initiative sets goals for renewable power and tree planting.'],
    sources: [GCC_MEI, GCC_ORF],
  },
  Kuwait: {
    stage: 'recent',
    target: 'Net zero by 2060, announced in 2022.',
    steps: ['The target is recent and most of the power still comes from oil and gas.'],
    sources: [GCC_ORF, NET_ZERO_TRACKER],
  },
  Bahrain: {
    stage: 'recent',
    target: 'Net zero by 2060, announced in October 2021.',
    steps: [],
    sources: [GCC_MEI, GCC_ORF],
  },
  Oman: {
    stage: 'recent',
    target: 'Net zero by 2050, announced in 2022, shortly before the COP27 summit.',
    steps: [],
    sources: [GCC_MEI, GCC_ORF],
  },
  Qatar: {
    stage: 'none',
    target: 'No net-zero target. The stated goal is to cut emissions by 25 % by 2030.',
    steps: [],
    sources: [GCC_MEI, GCC_ORF],
  },
  Egypt: {
    stage: 'none',
    target: 'No net-zero target.',
    steps: [
      'Launched a National Climate Change Strategy 2050 in May 2022; it has no overall emissions-cut target.',
      'Hosted the COP27 climate summit in Sharm El-Sheikh in 2022.',
      'Aims for 42 % of its electricity from renewables by 2030.',
    ],
    sources: [
      { label: 'Climate Action Tracker: Egypt, targets', url: 'https://climateactiontracker.org/countries/egypt/targets/' },
      { label: 'Enerdata: Egypt unveils its National Climate Change Strategy 2050', url: 'https://www.enerdata.net/publications/daily-energy-news/egypt-unveils-its-national-climate-change-strategy-2050.html' },
    ],
  },
  'United Kingdom': {
    stage: 'long',
    target: 'Net zero by 2050, written into law in June 2019.',
    steps: ['Its Climate Change Act dates from 2008, one of the first national climate laws in the world.'],
    sources: [CCN_2019, NS_ENERGY],
  },
  Sweden: {
    stage: 'long',
    target: 'Net zero by 2045, set in its Climate Policy Framework in 2017.',
    steps: [],
    sources: [CCN_2019, NS_ENERGY],
  },
  Germany: {
    stage: 'long',
    target: 'Climate neutral by 2045, in law since June 2021; its first climate law, with a 2050 goal, passed in 2019.',
    steps: ['The 2045 date was brought forward after a court ruled the earlier law too weak.'],
    sources: [NS_ENERGY, NET_ZERO_TRACKER],
  },
  Japan: {
    stage: 'recent',
    target: 'Net zero by 2050, pledged in October 2020 and written into law in May 2021.',
    steps: [],
    sources: [NS_ENERGY, NET_ZERO_TRACKER],
  },
  China: {
    stage: 'recent',
    target: 'Carbon neutral before 2060, pledged at the United Nations in September 2020. It is a pledge, not a law.',
    steps: [],
    sources: [NS_ENERGY, NET_ZERO_TRACKER],
  },
  India: {
    stage: 'recent',
    target: 'Net zero by 2070, pledged at the COP26 summit in Glasgow in November 2021.',
    steps: [],
    dataNote:
      'New Delhi cools in this dataset. That is not climate policy at work. Researchers link the weak daytime warming of the north Indian plain mainly to thick air-pollution haze that blocks sunlight, with heavy irrigation also suggested, and warn it could flip to faster warming as the air gets cleaner.',
    sources: [
      { label: 'Deccan Herald: aerosols and irrigation behind India’s slower warming (2026)', url: 'https://www.deccanherald.com/india/aerosol-irrigation-behind-indias-slower-warming-than-world-average-report-3974915' },
      { label: 'The Quint: India’s 2070 net-zero target', url: 'https://www.thequint.com/climate-change/net-zero-india-target-2070-where-does-rest-of-world-stand' },
      NET_ZERO_TRACKER,
    ],
  },
  Australia: {
    stage: 'recent',
    target: 'Net zero by 2050, pledged in 2021 and written into law by the Climate Change Act 2022.',
    steps: [],
    sources: [NET_ZERO_TRACKER],
  },
}
