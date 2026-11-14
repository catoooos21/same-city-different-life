/**
 * "Why might this be?" content. This is CONTEXT from history and research, written by the team.
 * The NASA data in this app shows THAT a change happened; it cannot say WHAT caused it, and the
 * page says so. Edit freely: add a country by adding an entry to CONTEXT keyed by the country
 * name as it appears in the city list (GeoNames English name).
 */

export interface Era {
  from: number
  to: number
  title: string
  text: string
}

export interface CountryContext {
  /** What the country was going through, by period. Shown when an era overlaps Then or Now. */
  eras: Era[]
  /** Everyday life choices that add heat locally, in this country. */
  choices: string[]
  sources?: { label: string; url: string }[]
}

/** Reasons that apply everywhere, in plain words. */
export const GLOBAL_REASONS: string[] = [
  'The whole planet is warmer. Burning oil, gas and coal has warmed Earth by about 1.2 °C since the 1800s, and most of that came after 1980.',
  'Cities make their own heat. Asphalt, concrete and glass soak up the sun by day and give it back at night, which is why hot nights rise fastest.',
  'Cars and air conditioners push heat out into the street, so the more of them there are, the hotter the city gets.',
]

/** Life choices that apply in most cities. Used when a country has no entry below. */
export const GENERIC_CHOICES: string[] = [
  'More trips by car, fewer on foot.',
  'More air conditioning running around the clock.',
  'More paved ground, fewer trees and gardens.',
  'Buildings spreading outward, so more land is covered.',
]

export const CONTEXT: Record<string, CountryContext> = {
  Kuwait: {
    eras: [
      {
        from: 1981,
        to: 1989,
        title: 'The oil-boom city',
        text: 'About 1.4 million people. Suburbs spread along the coast and the ring roads. The car and the air conditioner were already the way of life.',
      },
      {
        from: 1990,
        to: 1991,
        title: 'Invasion and the oil fires',
        text: 'Iraq invaded in August 1990. In 1991 some 600 to 700 oil wells burned for months, until November, and smoke darkened the sky. 1991 and 1992 show up as cooler years in the data: the smoke, plus a huge volcano eruption in the Philippines in 1991 that cooled the whole planet for a year or two.',
      },
      {
        from: 1992,
        to: 2004,
        title: 'Rebuilding',
        text: 'People came back and the country rebuilt. The population passed 2 million again around 2000.',
      },
      {
        from: 2005,
        to: 2014,
        title: 'The construction boom',
        text: 'New highways, towers and desert suburbs. The population passed 3 million and more than a million cars were added to the roads.',
      },
      {
        from: 2015,
        to: 2025,
        title: 'Five million people, nearly three million cars',
        text: 'Around 4.9 million people by 2024 and about 2.8 million registered vehicles. Air conditioning takes roughly 70 % of the electricity at the summer peak.',
      },
    ],
    choices: [
      'A private car for almost every trip.',
      'Air conditioning around the clock: about 70 % of summer peak electricity.',
      'Concrete, asphalt and glass where sand, gardens and palm groves were.',
      'New suburbs built deep in the desert, far from the sea breeze.',
    ],
    sources: [
      { label: 'UN World Population Prospects 2024', url: 'https://population.un.org/wpp/' },
      { label: 'Kuwait EPA, National Communication to the UNFCCC (2019): air conditioning and peak electricity', url: 'https://unfccc.int/documents/' },
      { label: 'CEIC: registered vehicles in Kuwait', url: 'https://www.ceicdata.com/en/indicator/kuwait/number-of-registered-vehicles' },
      { label: 'US Department of Defense: chronology of the 1991 Kuwait oil well fires', url: 'https://gulflink.osd.mil/owf_ii/owf_ii_s03.htm' },
    ],
  },
  Egypt: {
    eras: [
      {
        from: 1981,
        to: 1990,
        title: 'Cairo spills onto the fields',
        text: 'About 45 million Egyptians. Cairo grew fast, and new neighbourhoods were built on Delta farmland without permits. Most trips were by bus, shared taxi or on foot. The first metro line opened in 1987.',
      },
      {
        from: 1991,
        to: 2004,
        title: 'Into the desert',
        text: 'The economy opened up. New desert cities rose around Cairo: 6th of October, Sheikh Zayed and, from 2000, New Cairo. The Ring Road wrapped the city and the private car became the goal. The population passed 60 million in the mid-1990s.',
      },
      {
        from: 2005,
        to: 2013,
        title: 'Compounds, cars and blackouts',
        text: 'Gated compounds spread into the desert and cars filled the roads. After the 2011 revolution, building on farmland sped up to roughly 30,000 feddans a year. The summers of 2012 to 2014 brought rolling power cuts in the heat.',
      },
      {
        from: 2014,
        to: 2025,
        title: 'A hundred million people',
        text: 'The population passed 100 million in February 2020. A new capital has been under construction in the desert since 2015, and new highways and bridges cut through Cairo, with trees removed to widen roads. About 10 million licensed vehicles, 2.6 million of them in Cairo. The power grid breaks its summer record almost every year, and in 2023 and 2024 that meant rolling power cuts again.',
      },
    ],
    choices: [
      'A private car or a ride-hailing app instead of the bus or a walk: about 10 million licensed vehicles, 2.6 million in Cairo alone.',
      'Air conditioning becoming normal at home and in every shop, which is why summer electricity sets a new record almost every year.',
      'Houses and flats built on Delta farmland: roughly 30,000 feddans of fields lost a year after 2011.',
      'New desert cities and compounds far from the Nile, reached by car.',
      'Trees cut and gardens paved for wider roads and bridges.',
    ],
    sources: [
      { label: 'UN World Population Prospects 2024', url: 'https://population.un.org/wpp/' },
      { label: 'Ahram Online: population reaches 100 million (CAPMAS, February 2020)', url: 'https://english.ahram.org.eg/NewsContent/1/64/362720/Egypt/Politics-/Egypts-population-to-hit--million-at-home-next-wee.aspx' },
      { label: 'Arab Finance: licensed vehicles in Egypt, 2023 (CAPMAS)', url: 'https://www.arabfinance.com/News/newdetails/13932' },
      { label: 'Ahram Online: power grid hits a record 40,000 MW in a heatwave', url: 'https://english.ahram.org.eg/News/574471.aspx' },
      { label: 'Scientific American: Nile Delta under threat from illegal building', url: 'https://www.scientificamerican.com/article/nile-river-delta-under-threat-from-illegal-building/' },
    ],
  },
}

/** Pace line shown under the "vs the world" comparison. Source: NASA climate evidence page. */
export const PACE_LINE =
  'Even a small change is a fast one. The world is now warming about 10 times faster than it did when it came out of the last ice age.'
export const PACE_SOURCE = { label: 'NASA: Climate change evidence', url: 'https://science.nasa.gov/climate-change/evidence/' }

/**
 * "Two futures": what would keep the trend going, and what could slow it. Plain-word context from
 * research, written by the team; the data in this app cannot prove any of it. Edit freely.
 */
export const KEEPS_GOING: string[] = [
  'The world keeps burning oil, gas and coal the way it does today, so the whole planet keeps warming.',
  'The city keeps spreading: more asphalt, concrete and glass, fewer trees and less open ground.',
  'More cars and more air conditioners every year, each one pushing its heat out into the street.',
  'Buildings that soak up the sun, so they need more cooling, which heats the street even more.',
]
export const SLOWS_DOWN: string[] = [
  'The world burns less oil, gas and coal and makes more of its electricity from the sun and the wind. This is the big one, and no city can do it alone.',
  'Trees and shade: parks, street trees and green roofs cool the streets around them.',
  'Light-coloured roofs and pavements that bounce sunlight back instead of storing it.',
  'Fewer car trips: metro, buses, and shaded streets people can walk.',
  'Better-insulated buildings and efficient cooling, so less heat is pumped outdoors.',
]
export const FUTURE_NOTE =
  'Cutting pollution worldwide slows the warming itself. Trees, shade and lighter surfaces cool a city’s own streets, mostly its hot nights. Rain is different: no city can steer it.'
export const FUTURE_SOURCES = [
  { label: 'NASA: causes of climate change', url: 'https://science.nasa.gov/climate-change/causes/' },
  { label: 'NASA: mitigation and adaptation', url: 'https://science.nasa.gov/climate-change/adaptation-mitigation/' },
  { label: 'US EPA: heat island reduction solutions', url: 'https://www.epa.gov/heatislands/what-you-can-do-reduce-heat-islands' },
]

/** "If it keeps going" projection: birth year of the future kid. A straight-line extension of the trend, not a forecast. */
export const FUTURE_BIRTH_YEAR = 2040
