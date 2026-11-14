/**
 * Where a country stands: what it is actually doing, and why its pollution is where it is.
 * This is CONTEXT written by the team from public sources, not NASA data, and the card says so.
 * It is never presented as the cause of a weather change: a country's rules cannot cool its own
 * weather, because the air is shared and warming follows what the whole world burns.
 *
 * The stamp itself (Improving / Starting / Getting worse) comes from the country's CO2 data, see
 * emissions.ts. `stage` feeds one part of that rule: a country whose first net-zero target dates
 * from 2020 or later counts as "Starting" even if its CO2 has not turned yet.
 *   long   = first national net-zero target by 2019
 *   recent = first national net-zero target in 2020 or later
 *   none   = no national net-zero target so far
 *
 * Add a country by adding an entry keyed by its name in the city list (GeoNames English name).
 * Please check every fact against its source before presenting.
 */

export type ActionStage = 'long' | 'recent' | 'none'

export interface CountryAction {
  stage: ActionStage
  /** One line: the target and when it was set. */
  target: string
  /** What the country is actually doing, in plain words. */
  doing: string[]
  /** Why its pollution is still high or rising. Shown when it is not falling. */
  why: string[]
  sources: { label: string; url: string }[]
}

/** Used when we have not written up a country. */
export const GENERIC_DOING =
  'Where pollution is falling, a country has usually swapped coal and oil for cleaner electricity and made its buildings, cars and factories waste less. We have not written up this country’s own steps yet.'
export const GENERIC_WHY =
  'Pollution usually keeps climbing where the number of people, cars and air conditioners grows faster than clean electricity is added. We have not written up this country’s own reasons yet.'

const NET_ZERO_TRACKER = { label: 'Net Zero Tracker', url: 'https://zerotracker.net/' }
const GCC_MEI = { label: 'Middle East Institute: The GCC and the road to net zero', url: 'https://mei.edu/publications/gcc-and-road-net-zero' }
const GCC_ORF = { label: 'ORF: Energy transitions in the Gulf (2025)', url: 'https://www.orfonline.org/research/energy-transitions-in-the-gulf-realities-risks-and-the-road-ahead' }
const CCN_2019 = { label: 'Climate Home News: which countries have a net-zero goal (2019)', url: 'https://climatechangenews.com/2019/06/14/countries-net-zero-climate-goal/' }
const NS_ENERGY = { label: 'NS Energy: countries with net-zero targets', url: 'https://www.nsenergybusiness.com/analysis/countries-net-zero-emissions/' }

export const ACTIONS: Record<string, CountryAction> = {
  'United Arab Emirates': {
    stage: 'recent',
    target: 'Net zero by 2050, pledged in 2021: the first country in the Middle East and North Africa to do so.',
    doing: [
      'A national climate law came into force on 30 May 2025: every company, including those in free zones, must measure, report and plan to cut its emissions.',
      'Built Barakah, the Arab world’s first nuclear power plant; all four reactors have been running since 2024.',
      'Built some of the world’s largest solar parks, near Dubai and Abu Dhabi.',
      'Bans outdoor work in direct sun around midday every summer, to protect workers from the heat.',
    ],
    why: ['Most electricity and seawater desalination still run on gas, air conditioning uses a great deal of power, and the population keeps growing.'],
    sources: [
      { label: 'The National: UAE climate law comes into force (June 2025)', url: 'https://www.thenationalnews.com/news/uae/2025/06/02/landmark-uae-climate-law-aims-to-curb-emissions-and-boost-net-zero-ambitions' },
      { label: 'PwC: UAE Climate Change Law', url: 'https://www.pwc.com/m1/en/services/assurance/manage-risk-in-business/uae-climate-change-law.html' },
      GCC_MEI,
    ],
  },
  'Saudi Arabia': {
    stage: 'recent',
    target: 'Net zero by 2060, announced in October 2021 at the first Saudi Green Initiative Forum.',
    doing: ['The Saudi Green Initiative aims for about half of the country’s electricity from renewables by 2030 and for billions of trees to be planted.'],
    why: ['Oil and gas are still burned for almost all electricity, for desalinating seawater and for air conditioning, and industry and the population are growing.'],
    sources: [GCC_MEI, GCC_ORF],
  },
  Kuwait: {
    stage: 'recent',
    target: 'Net zero by 2060, announced in 2022.',
    doing: ['Building the Shagaya renewable energy park in the desert, with a national goal of 15 % of electricity from renewables by 2030.'],
    why: [
      'Almost all electricity still comes from burning oil and gas.',
      'Air conditioning takes about 70 % of the electricity at the summer peak.',
      'Electricity and fuel are cheap, and nearly every trip is by private car.',
    ],
    sources: [GCC_ORF, NET_ZERO_TRACKER],
  },
  Bahrain: {
    stage: 'recent',
    target: 'Net zero by 2060, announced in October 2021.',
    doing: [],
    why: ['Electricity comes from gas, and the country runs one of the world’s largest aluminium smelters.'],
    sources: [GCC_MEI, GCC_ORF],
  },
  Oman: {
    stage: 'recent',
    target: 'Net zero by 2050, announced in 2022, shortly before the COP27 summit.',
    doing: ['Planning large green-hydrogen projects powered by sun and wind.'],
    why: ['Electricity comes from gas, and industry is expanding.'],
    sources: [GCC_MEI, GCC_ORF],
  },
  Qatar: {
    stage: 'none',
    target: 'No net-zero target. The stated goal is to cut emissions by 25 % by 2030.',
    doing: [],
    why: ['It is expanding its production of liquefied natural gas, and its CO₂ per person is among the highest in the world.'],
    sources: [GCC_MEI, GCC_ORF],
  },
  Egypt: {
    stage: 'none',
    target: 'No net-zero target. A National Climate Change Strategy 2050 was launched in May 2022, without an overall emissions-cut target.',
    doing: ['Built the Benban solar park near Aswan, one of the largest in the world.', 'Aims for 42 % of its electricity from renewables by 2030.', 'Hosted the COP27 climate summit in 2022.'],
    why: ['More than 100 million people and growing, and most electricity still comes from gas.'],
    sources: [
      { label: 'Climate Action Tracker: Egypt, targets', url: 'https://climateactiontracker.org/countries/egypt/targets/' },
      { label: 'Enerdata: Egypt unveils its National Climate Change Strategy 2050', url: 'https://www.enerdata.net/publications/daily-energy-news/egypt-unveils-its-national-climate-change-strategy-2050.html' },
    ],
  },
  'United Kingdom': {
    stage: 'long',
    target: 'Net zero by 2050, written into law in June 2019.',
    doing: [
      'Has had a national climate law since 2008, one of the first in the world, with a legal limit on emissions every five years.',
      'Closed its last coal power station in 2024.',
      'Built one of the world’s largest fleets of offshore wind farms.',
    ],
    why: [],
    sources: [CCN_2019, NS_ENERGY],
  },
  Sweden: {
    stage: 'long',
    target: 'Net zero by 2045, set in its Climate Policy Framework in 2017.',
    doing: ['Has taxed carbon pollution since 1991.', 'Makes almost all of its electricity from water, nuclear and wind power.'],
    why: [],
    sources: [CCN_2019, NS_ENERGY],
  },
  Germany: {
    stage: 'long',
    target: 'Climate neutral by 2045, in law since June 2021; its first climate law passed in 2019.',
    doing: ['Now makes more than half of its electricity from renewables.', 'Has a law to end coal power by 2038 at the latest.'],
    why: [],
    sources: [NS_ENERGY, NET_ZERO_TRACKER],
  },
  Japan: {
    stage: 'recent',
    target: 'Net zero by 2050, pledged in October 2020 and written into law in May 2021.',
    doing: ['Its emissions have fallen since 2013: more solar power, less wasted energy and nuclear plants restarting.'],
    why: [],
    sources: [NS_ENERGY, NET_ZERO_TRACKER],
  },
  China: {
    stage: 'recent',
    target: 'Carbon neutral before 2060, pledged at the United Nations in September 2020. It is a pledge, not a law.',
    doing: ['Builds more solar and wind power each year than the rest of the world put together.'],
    why: ['Coal still makes most of its electricity, and it has the world’s largest heavy industry.'],
    sources: [NS_ENERGY, NET_ZERO_TRACKER],
  },
  India: {
    stage: 'recent',
    target: 'Net zero by 2070, pledged at the COP26 summit in Glasgow in November 2021.',
    doing: ['Aims for 500 gigawatts of non-fossil power by 2030 and is adding solar quickly.'],
    why: ['A fast-growing economy and population, with coal making about 70 % of the electricity.'],
    sources: [
      { label: 'The Quint: India’s 2070 net-zero target', url: 'https://www.thequint.com/climate-change/net-zero-india-target-2070-where-does-rest-of-world-stand' },
      NET_ZERO_TRACKER,
    ],
  },
  Australia: {
    stage: 'recent',
    target: 'Net zero by 2050, pledged in 2021 and written into law by the Climate Change Act 2022, with a 43 % cut by 2030.',
    doing: ['Its old coal power stations are closing.', 'Has one of the highest rates of rooftop solar in the world.'],
    why: [],
    sources: [NET_ZERO_TRACKER],
  },
}
