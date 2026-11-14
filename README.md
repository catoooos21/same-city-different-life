# Same City, Different Life

*NASA Space Apps Challenge 2026, 14–15 November. Challenge: “Be An Earth System Trend Detective!” (Advanced; Earth Science + Software). Official text in [docs/challenge.md](docs/challenge.md).*

Pick any city on Earth and compare daily life there in two periods, using 45 years of NASA weather data.
The opening story is **Two Childhoods**: a kid born in 1981 and a kid born in 2015, same city, first ten
years of life. *Same city. Same age. A different childhood.* Then switch the life being compared: kid,
outdoor worker, farmer, runner, older person, traveller. Same data, different numbers.

It is not a dashboard and not a globe. It looks like two scrapbook pages side by side, with sticky notes
between them saying what changed, and a stamp saying whether the change is real.

For every number the app answers the four challenge questions:

| Question | Where it is answered |
|---|---|
| **What** is changing | each lens is a list of plain-language metrics (unusually hot days, unusually warm nights, rainy days, perfect outdoor days, …) |
| **Where** | any city (GeoNames, population > 100,000) or any coordinates; the MERRA-2 grid cell for that point |
| **How much** | Then vs Now averages, their difference, and Sen’s slope per decade with a 95 % confidence interval |
| **Significant?** | Mann-Kendall test with the Hamed–Rao autocorrelation correction, shown as **Real change** (p < 0.05) or **No clear change** (no significant trend) |

## Try it

Demo cities (Kuwait City, London, Sydney, Delhi) are bundled and open instantly. Any other city is fetched
live from NASA POWER in about three seconds and cached in the browser.

```bash
cd web
npm install
npm run dev
```

Every result has a shareable URL, for example `#name=Kuwait+City&lat=29.3759&lon=47.9774&mode=child&b1=1981&b2=2015&lens=kid`.

## NASA data

**NASA POWER daily point API** (no key, no login): meteorology from NASA’s **MERRA-2** reanalysis, the
model the challenge text names explicitly. Six daily parameters, 1981-01-01 to 2025-12-31:
`T2M_MAX`, `T2M_MIN`, `T2M`, `T2MDEW`, `PRECTOTCORR`, `RH2M`.

Before writing any code we made a real request and checked the API ([web/src/power.ts](web/src/power.ts) records the findings):

| Check | Found on 2026-11-13 |
|---|---|
| Units | °C for temperatures and dew point, mm/day for precipitation, % for humidity |
| Missing value | `-999` (declared as `fill_value` in the header) |
| Date range | starts exactly 1981-01-01 (earlier dates give HTTP 422); runs to three days before today |
| Parameter limit | 20 per request (we need 6) |
| CORS | `Access-Control-Allow-Origin: *` on GET, so the browser calls POWER directly |
| Size and time | 16,436 days, about 1.6 MB and 3 s for six parameters over 45 years |
| Time standard | local solar time, so daily max/min are true local days |

Rules applied everywhere: full calendar years 1981–2025 only, never 2026; a year is dropped for a metric
when more than 10 % of its days are missing; leap days count like any other day.

**NASA GISTEMP v4** global annual mean (land-ocean) gives the “vs the world” line under the scrapbooks.

**City search**: GeoNames cities with population > 100,000 (6,266 cities; name, country, lat, lon), CC BY 4.0.

## Metrics (all thresholds live in one file)

Defined in [web/src/config/metrics.ts](web/src/config/metrics.ts) and printed verbatim in the app’s “How do we know?” panel.
Local thresholds use each city’s own 1981–2010 baseline, so “hot” means hot for that place.

| Metric | Definition | ETCCDI |
|---|---|---|
| Hot days | daily max > city’s 90th percentile of baseline daily max | TX90p (whole-year percentile variant) |
| Very hot days | daily max ≥ 35 °C (shown only where it happens) | |
| Hot nights | daily min > city’s 90th percentile of baseline daily min | TN90p (variant) |
| Tropical nights | daily min ≥ 20 °C (shown only where it happens) | TR |
| Heatwave days | days inside runs of ≥ 3 consecutive hot days; runs may cross New Year (Southern Hemisphere) | |
| Frost days | daily min < 0 °C (shown only where it happens) | FD |
| Rainy days | precipitation ≥ 1 mm | R1mm |
| Heavy rain days | precipitation ≥ 10 mm | R10mm |
| Biggest downpour | wettest day of the year, mm | Rx1day |
| Longest dry spell | most consecutive days < 1 mm within the year | CDD |
| Sticky days | daily mean dew point ≥ 20 °C | |
| Perfect outdoor days | max 18–30 °C, precipitation < 1 mm, dew point < 20 °C | |
| Good training days | mean 5–20 °C, precipitation < 1 mm, dew point < 16 °C | |

“Perfect outdoor days” follows the “outdoor days” idea of Choi, Y.-W., Khalifa, M. and Eltahir, E. A. B.
(2024), *North–South disparity in impact of climate change on “outdoor days”*, Journal of Climate,
[doi:10.1175/JCLI-D-23-0346.1](https://doi.org/10.1175/JCLI-D-23-0346.1). Their thresholds are
temperature-only and user-adjustable; ours add rain and humidity and are our own.

The outdoor calendar shows perfect outdoor days per month, Then vs Now.

## Lenses (“Who are you?”)

Defined in [web/src/config/lenses.ts](web/src/config/lenses.ts). Adding a lens is a config change only.

| Lens | Metrics |
|---|---|
| Kid / parent | unusually hot days (hot days), unusually warm nights (hot nights), rainy days, sticky days, perfect play days, outdoor calendar |
| Outdoor worker | very hot workdays, hot days, heatwave days, sticky days — labelled as a weather proxy, not a safety standard |
| Farmer / gardener | longest dry spell, heavy rain days, biggest downpour, frost days, rainy days |
| Runner / athlete | good training days, hot days, sticky days, calendar |
| Older person | hot nights, tropical nights, heatwave days, very hot days |
| Traveller / event planner | perfect outdoor days, rainy days, very hot days, outdoor calendar |

Modes: **Two childhoods** (birth year b → years b to b+9; birth years 1981–2016) and **Any two periods**
(default 1981–1990 vs 2016–2025).

## Statistics

For each city and metric the app builds one value per year, 1981–2025, then:

- **Trend test**: Mann-Kendall with the Hamed and Rao (1998) variance correction for autocorrelation.
  If the correction produces a non-finite variance the plain test is used and the panel says so.
- **Slope**: Sen’s slope (median of pairwise slopes) with a 95 % confidence interval (Sen 1968, eq. 2.6).
- **Report**: change per decade with CI, the average per year in each period, the difference between the
  periods, the p-value, the number of complete years, and the label *Real change* (p < 0.05) or *No clear change*.
  A “No clear change” still shows the slope: a trend can be interesting without reaching significance.

The statistics run in the browser ([web/src/stats.ts](web/src/stats.ts)). They are a line-by-line port of
`pymannkendall.hamed_rao_modification_test` and `scipy.stats.theilslopes`, and
[web/src/__tests__/stats.test.ts](web/src/__tests__/stats.test.ts) checks them against values produced by
those Python packages on eight reference series (noise, ties, AR(1) autocorrelation, gaps, mostly zeros,
and the real Kuwait hot-days series). The Python reference lives in [pipeline/stats.py](pipeline/stats.py);
regenerate the fixtures with `python -m pipeline.tests.make_js_fixtures`.

```bash
cd web && npm test            # 62 tests: statistics vs Python, calendar, metrics engine, missing-day rule, case file, two cities, two futures
python -m pytest pipeline/tests   # Python reference tests
```

## Limits (also shown in the app)

- MERRA-2 is a model fed by observations, not a thermometer. Temperature and humidity trends are robust;
  precipitation at one point is less certain even in the bias-corrected product.
- One grid cell (about 50 km) stands for a whole city. Coastal cells may be partly sea.
- Reanalyses can show small artificial jumps when the assimilated satellites change.
- Two childhoods less than ten years apart share years, which makes their difference smaller, not larger.
- The outdoor-worker lens is a weather proxy, not an occupational safety standard.

## Repository

```
web/                    Vite + React + TypeScript app (static; deploys to GitHub Pages)
  src/config/           metrics.ts (thresholds, definitions), lenses.ts (who-are-you lists)
  src/stats.ts          Mann-Kendall (Hamed-Rao), Sen's slope + CI, percentile
  src/metrics.ts        daily -> annual series, runs, calendar, periods
  src/power.ts          NASA POWER client + IndexedDB cache + demo loader
  src/components/       CitySearch, Scrapbook, YearChart, Methods
  public/cities.json    GeoNames cities > 100k (built by scripts/build_cities.py)
  public/demo/          four bundled cities (scripts/fetch_demo_cities.py)
pipeline/stats.py       Python reference statistics + tests, fixture generator
docs/challenge.md       official challenge text
```

Deploy: the GitHub Pages workflow in `.github/workflows/pages.yml` builds `web/` on every push to `main`.

## Team

*to be filled in*

## Use of AI

Space Apps asks teams to disclose how AI tools were used. This project was built as a pair-programming
session between the team and Claude (Anthropic) in Claude Code, following a brief written by the team:

- Claude made the first real NASA POWER request and reported the API’s units, fill value, date limits,
  parameter limit and CORS behaviour before any code was written; the design was adapted to those facts.
- Claude wrote the web app, the JavaScript statistics port and its tests against the Python packages, the
  metric and lens configuration, the city-list and demo-fetch scripts, and drafts of this README.
- Every number on screen is computed in the browser from NASA POWER data. The sentences on the sticky
  notes are templates filled with computed numbers; no AI model runs at any point in the app.
- The team chose the concept, the metrics, the statistical tests and the limitations, and is responsible
  for the scientific interpretation.

No NASA logos or insignia are used.
