# What we did and how we did it

*Same City, Different Life. NASA Space Apps Challenge 2026, 14–15 November. Challenge: "Be An Earth System Trend Detective!"*

This file is the plain story of the project: what the app is, what we built, in what order, how it works, how to run it on any computer, and what to say about it. The technical reference (data checks, metric definitions, statistics) is in [README.md](README.md). The official challenge text is in [docs/challenge.md](docs/challenge.md).

- Live site: https://catoooos21.github.io/same-city-different-life/
- Code: https://github.com/catoooos21/same-city-different-life

---

## 1. The idea in one paragraph

Pick any city on Earth. The app opens two scrapbook pages side by side: a kid born in 1981 and a kid born in 2015, same city, first ten years of life. Between the pages, sticky notes say what changed in everyday words ("37 more days too hot to play outside, every year") with a stamp that says **Real change** or **No clear change**. You can switch who you are (kid, outdoor worker, farmer, runner, older person, traveller) and the same weather is told from that life. Everything comes from 45 years of NASA daily weather data, computed live in the browser. No account, no key, no server.

The problem it answers: climate numbers like "+1.2 °C" mean nothing to most people. Days you cannot play outside, nights too hot to sleep, and rainy days you lose do.

## 2. Timeline (what happened, in order)

All work happened on 13–14 November 2026.

| When | What |
|---|---|
| 13 Nov, afternoon | **Old concept** ("Ghubar Holmes", Kuwait dust and heat). Scaffolded a repo, checked NASA datasets, wrote the trend statistics in Python with tests. Built a first web app with maps. Commits `6f71f84`, `9f7dfdc`, `697962d`. |
| 13 Nov, evening | **Pivot** to "Same City, Different Life" after a new brief from the team: any city, two periods, NASA POWER daily data, scrapbook look. Before writing code we made a real request to the POWER API and recorded what it returns (units, missing value, date limits, CORS). Rebuilt the app around it. Commit `8940f38`. |
| 13 Nov, about 23:00 | Pushed to GitHub, made the repo public, turned on GitHub Pages with source "GitHub Actions". First live deploy. |
| 13 Nov, 23:00 to midnight | **Simplified every visible word.** Removed slopes, confidence intervals and p-values from the cards; statistics now live only behind "tap any number" and the "Details for the curious" fold. Plain "How do we know?" panel. Renamed "Can't tell" to **No clear change**. Added the hint when the two periods overlap. |
| 14 Nov, 00:00 | Added **"Why might this be?"**: global reasons, what the country was going through in each era, life choices that add heat, sources. Added the **pace line** (the world is warming about 10 times faster than when it left the last ice age). Added **"Born 2040, if it keeps going"**, a straight-line what-if on every card with a real change. Commit `56d151b`. |
| 14 Nov, 06:46 | Added **Egypt** to the country context (Kuwait and Egypt have entries; every other country gets a generic list). Commit `d19d76a`. |
| 14 Nov, morning | Added the **case file** (every metric of the city ranked by strength of evidence, with a 45-year sparkline), **sparklines** on the sticky notes, and **Two futures**: a kid born in 2030, 2040 or 2050 if the trend keeps going or slows to half pace, with how each could happen and the main reason highlighted. A what-if, not a forecast. We tried NASA POWER's climate-projection API (NEX-GDDP-CMIP6) for real model data, but it returned only missing values. |

## 3. How it works

### The data
- **NASA POWER daily point API** (MERRA-2 reanalysis). Six values per day from 1 January 1981 to 31 December 2025 for the exact latitude and longitude of the city: max temperature, min temperature, mean temperature, dew point, rain, humidity. About 1.6 MB and 3 seconds per city.
- The browser calls NASA directly (the API allows it) and keeps a copy in IndexedDB, so the second visit is instant.
- Four demo cities (Kuwait City, London, Sydney, Delhi) are bundled in `web/public/demo/` so the demo never depends on the network.
- **NASA GISTEMP** yearly global temperature gives the "vs the world" line.
- **GeoNames** gives the 6,266 cities over 100,000 people in the search box.

### The numbers
- For each year 1981–2025 we count things people feel: hot days, hot nights, heatwave days, frost days, rainy days, heavy-rain days, the biggest downpour, the longest dry spell, sticky days, perfect outdoor days, training days. "Hot" means hot **for this city**: above the 90th percentile of 1981–2010, so Kuwait and London each get their own bar.
- "Then" and "Now" are the average over each ten-year period. The sticky note shows the difference.
- The stamp comes from a **Mann-Kendall trend test** (with the Hamed–Rao correction for years that are like their neighbours) on the full 45-year series, with **Sen's slope** for the size of the trend. **Real change** = p < 0.05. **No clear change** = the years jump around with no steady direction.
- The JavaScript statistics were checked against the Python packages `pymannkendall` and `scipy` on the same series. 53 automated tests pass (`npm test` in `web/`).
- "Born 2040, if it keeps going" is the trend line stretched to the years 2040–2049. It is labelled as a what-if, not a forecast, and only appears where the change is real.

### The page, top to bottom
1. Controls: city, Two childhoods / Any two periods, birth years or periods, who you are.
2. Two scrapbook pages (Then, Now) with sticky notes in the middle. Tap any number to open the 45-year chart with the trend line.
3. Outdoor calendar: perfect days per month, then vs now.
4. "X is warming about N times faster than the world" plus the pace line.
5. "Why might this be?": global reasons, country eras, life choices, sources. This is history and research written by us; the page says the data cannot prove causes.
6. "How do we know?": six plain sentences, then "Details for the curious" with everything a judge might ask.
7. Copy link. Every state is in the URL, so any result can be shared.

## 4. Where things live

```
web/                        the app (Vite + React + TypeScript, no other libraries)
  src/config/metrics.ts     every metric: name, plain one-liner, definition, threshold, ETCCDI code
  src/config/lenses.ts      who-are-you lists: which metrics each life sees and the sentence templates
  src/config/context.ts     "Why might this be?" text: global reasons, Kuwait and Egypt eras, pace line, 2040
  src/stats.ts              Mann-Kendall, Sen's slope, percentiles
  src/metrics.ts            daily data -> yearly counts -> then/now numbers
  src/power.ts              NASA POWER client, cache, demo loader
  src/components/           Scrapbook, YearChart, CitySearch, Methods, Context
  src/__tests__/            tests, including fixtures generated from Python
  public/cities.json        GeoNames list (built by scripts/build_cities.py)
  public/demo/              four bundled cities (scripts/fetch_demo_cities.py)
pipeline/stats.py           Python reference statistics and tests
scripts/                    city list and demo fetch scripts (Python)
docs/challenge.md           official challenge text
.github/workflows/pages.yml builds and deploys to GitHub Pages on every push to main
README.md                   technical reference
WHAT-WE-DID.md              this file
```

## 5. Run it on another computer (laptop setup)

You need Node.js 22 or newer and git. Python is only needed to rebuild the city list or demo files.

```bash
git clone https://github.com/catoooos21/same-city-different-life.git
cd same-city-different-life/web
npm install
npm run dev
```

Open the address it prints (usually http://localhost:5173). Other commands, all inside `web/`:

| Command | What it does |
|---|---|
| `npm test` | runs the 53 tests |
| `npm run typecheck` | TypeScript check |
| `npm run build` | production build into `web/dist/` |

To publish: commit and `git push origin main`. GitHub Actions builds and deploys in about two minutes. Nothing else to do.

## 6. How to change things

- **Add a country to "Why might this be?"**: open `web/src/config/context.ts`, copy the `Egypt` block, change the key to the country name exactly as it appears in the city search (English GeoNames name), fill in eras, choices and sources. Eras show when they overlap Then or Now.
- **Change a threshold or a definition**: `web/src/config/metrics.ts`. Nothing else needs to change.
- **Change a sentence on a card**: `web/src/config/lenses.ts` (the templates) or `web/src/components/Scrapbook.tsx` (the wording around them).
- **Change the plain text in "How do we know?"**: `web/src/components/Methods.tsx`.
- **Add a demo city**: add it to `DEMO_CITIES` in `web/src/power.ts`, then run `python scripts/fetch_demo_cities.py`.

## 7. Decisions we made and why

- **No server, no key.** The POWER API allows browser calls, so the app is a static site. It costs nothing, cannot go down on demo day because of our backend, and works on GitHub Pages.
- **Scrapbook, not dashboard.** The brief asked for it, and it is the point: two lives, not two charts.
- **Plain words on the cards, statistics one tap away.** Judges can find p-values; visitors never have to.
- **"No clear change" instead of "Can't tell".** It says what the data shows without sounding like the app failed.
- **Per-city thresholds.** A hot day in London is not a hot day in Delhi. Using each city's own 1981–2010 90th percentile makes every city's story fair.
- **The why-section is labelled as context.** NASA data shows that a change happened. It cannot say why. We wrote the history ourselves, with sources, and the page says so.
- **2040 is a what-if.** A straight line, clearly labelled, shown only where the trend is real.

## 8. What to say in the presentation

1. Open Kuwait City, 1981 vs 2015, kid. Read the sticky notes out loud. They are sentences, not numbers.
2. Switch to outdoor worker, then older person. Same weather, different life.
3. Tap a number: the 45-year chart appears, with the trend line. That is where the science lives.
4. Scroll to "vs the world" and read the pace line: even a small change is a fast one.
5. Scroll to "Why might this be?": the country's own history, era by era.
6. Point at "Born 2040, if it keeps going".
7. Type any city a judge names. It loads in about three seconds, straight from NASA.

## 9. Known limits (be honest about these)

- MERRA-2 is a weather model fed with observations, not a thermometer in the street. Heat is very reliable, rain less so.
- Coastal cities sit in a grid cell that may be partly sea, which cools the absolute numbers.
- Two people born close together share years, so their difference looks small. The app says so when it happens.
- Only Kuwait and Egypt have country-specific "why" text so far.
- The README "Team" section still needs names.

## 10. Use of AI

Built as a pair-programming session between the team and Claude (Anthropic) in Claude Code, following the team's brief. Claude verified the API, wrote the app, the statistics port and tests, and drafts of the documents. The team chose the concept, metrics, tests, wording, and the country histories, and checked the facts. No AI runs inside the app; every sentence on screen is a template filled with numbers computed from NASA data.
