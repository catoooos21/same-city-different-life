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
}

/** Pace line shown under the "vs the world" comparison. Source: NASA climate evidence page. */
export const PACE_LINE =
  'Even a small change is a fast one. The world is now warming about 10 times faster than it did when it came out of the last ice age.'
export const PACE_SOURCE = { label: 'NASA: Climate change evidence', url: 'https://science.nasa.gov/climate-change/evidence/' }

/** "If it keeps going" projection: birth year of the future kid. A straight-line extension of the trend, not a forecast. */
export const FUTURE_BIRTH_YEAR = 2040
