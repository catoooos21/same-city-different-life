# Ghubar Holmes: Kuwait Trend Detective

*NASA Space Apps Challenge 2026, Kuwait local event (AUK, 14-15 Nov 2026).*
*Challenge: "Be An Earth System Trend Detective!" (Advanced, Earth Science + Software).*

**Summary.** Ghubar Holmes ("ghubar" is Arabic for dust) is a public web app where anyone can open a
case file about Kuwait's environment and get a plain-language verdict backed by real NASA data and
real statistics. Each case answers four questions: **what** is changing, **where**, **how much**,
and **whether the change is statistically significant**. We use MODIS and MERRA-2 variables over
2001-2025 (land) and 2003-2025 (sea), remove seasonality with monthly anomalies, test trends with
the Mann-Kendall test (autocorrelation-corrected) and Sen's slope, and map per-pixel trends with a
false-discovery-rate correction. It should be fun to use and honest about what the data can and
cannot say. Every number on screen is produced by the pipeline in this repository from NASA data;
nothing is hand-typed or simulated.

## The cases

| Case | Question | Verdict (filled by the pipeline) |
|------|----------|----------------------------------|
| Heat | Is Kuwait heating up, and faster than the world? | *pending step 2* |
| Dust | Is Kuwait getting dustier? | *pending step 3* |
| Sea | Is the water around Kuwait getting warmer and greener? | *pending step 4* |
| Connected | Do hotter years bring more dust? | *pending step 7* |

Each verdict reports: what changed, where (map), how much (Sen's slope per decade, total change,
% vs baseline) and whether it is significant (p-value, number of years).

## Status (build log)

- [x] **Step 1** Repo scaffold, dataset check against NASA CMR, stats module with unit tests.
      See [docs/datasets_cmr_check.md](docs/datasets_cmr_check.md) for the availability table.
- [ ] Step 2 Heat case end-to-end + first deploy
- [ ] Step 3 Dust case
- [ ] Step 4 Sea case
- [ ] Step 5 Per-pixel trend maps
- [ ] Step 6 Heat strip + region picker
- [ ] Step 7 Connected case
- [ ] Step 8 Polish, About/Data page, final deploy

## Study area and period

- Land box: lon 46.5-48.5 E, lat 28.5-30.1 N, masked to Kuwait's border
  (Natural Earth admin-0). Governorates from geoBoundaries ADM1.
- Sea box: lon 47.6-49.0 E, lat 28.5-30.0 N, ocean pixels only.
- Full calendar years only. Land 2001-2025, sea 2003-2025. 2026 may be shown greyed out and is
  never used in a trend test.

## Datasets (verified against CMR on 2026-11-13)

| Short name | Version in CMR | Variables | Role | DOI |
|------------|----------------|-----------|------|-----|
| MOD11C3 (MODIS Terra, LP DAAC) | 061 | LST_Day_CMG, LST_Night_CMG | Monthly land surface temperature, 0.05 deg | 10.5067/MODIS/MOD11C3.061 |
| M2TMNXSLV (MERRA-2, GES DISC) | 5.12.4 | T2M, T2MMAX, T2MMIN | Monthly 2 m air temperature | 10.5067/AP1B0BA5PD2K |
| M2TMNXAER (MERRA-2, GES DISC) | 5.12.4 | DUEXTTAU, DUSMASS, TOTEXTTAU | Monthly dust optical depth and surface concentration | 10.5067/FH9A0MLJPC7N |
| MOD08_M3 (MODIS Terra, LAADS) | 6.1 (CMR lists Collection 6.1 as "6.1", not "061") | Deep Blue AOD 550 nm over land | Satellite cross-check of MERRA-2 dust | 10.5067/MODIS/MOD08_M3.061 |
| MODISA_L3m_SST (MODIS Aqua, OB.DAAC) | R2019.0 | sst | Monthly 4 km sea surface temperature | 10.5067/AQUA/MODIS/L3M/SST/2019 |
| MODISA_L3m_CHL (MODIS Aqua, OB.DAAC) | 2022.0 | chlor_a | Monthly 4 km chlorophyll-a | 10.5067/AQUA/MODIS/L3M/CHL/2022 |
| M2C0NXASM (MERRA-2 constants) | 5.12.4 | FRLAND, FROCEAN | Land/ocean mask on the MERRA-2 grid | 10.5067/ME5QX6Q5IGGU |
| GISTEMP v4 (NASA GISS) | - | GLB.Ts+dSST.csv | Global annual mean for the "vs the world" comparison | data.giss.nasa.gov/gistemp |

Fallback (only if Earthdata access breaks, and labelled in the app): NASA POWER API monthly
T2M / AOD_55, which are themselves derived from MERRA-2.

Notes from the CMR check: all collections exist and have every expected monthly granule for our
years and area. MODISA_L3m_CHL returns duplicate metadata records for months from July 2021
onward (same file, two CMR records); the pipeline dedupes by filename.

## Methods

1. **Regional series.** Area-weighted (cos latitude) mean over the AOI with a land-only or
   ocean-only mask.
2. **Seasonality removed.** Monthly anomalies against a 2001-2010 climatology (sea: 2003-2012).
3. **Trend test on annual means.** Mann-Kendall with the Hamed-Rao autocorrelation correction
   (`pymannkendall.hamed_rao_modification_test`). Magnitude: Sen's slope with 95 % CI
   (`scipy.stats.theilslopes`).
4. **Monthly check.** Seasonal Kendall test (period 12) on the monthly anomalies, plus a trend per
   calendar month for the month x year heat strip.
5. **Maps.** MK + Sen's slope on each grid cell's annual series, then Benjamini-Hochberg FDR
   (q = 0.05) across cells. Only FDR-significant cells are drawn solid; the rest are faded.
6. **Verdicts.** "Significant increase", "Significant decrease" or "No significant trend
   (we can't tell)" at alpha = 0.05, with slope per decade, total change, % change vs baseline,
   p-value and number of years.
7. **Chlorophyll** is analysed as log10(chl) because it is log-normally distributed.
8. **Connected case.** Pearson and Spearman correlation of annual dust vs temperature anomalies with
   a 95 % CI on r. Correlation is not causation and the app says so.

The statistics module is unit-tested with synthetic series of known slope
(`pipeline/tests/test_stats.py`). Synthetic data is used only in tests.

## Limitations (also shown in the app)

- MERRA-2 is a model (reanalysis). Changes in the observations it assimilates can create
  artificial jumps, so we cross-check dust against MODIS Deep Blue aerosol optical depth.
- Land surface temperature is not air temperature. The heat case shows both.
- Gulf water is sediment-rich, so MODIS chlorophyll is biased high. We trust trends in anomalies,
  not absolute values.
- 25 (land) and 23 (sea) years is a short record for climate trends; confidence intervals are wide
  and we report them.
- Correlation is not causation (Connected case).

## How to rebuild

```bash
# Python 3.11
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt      # on Linux/macOS: .venv/bin/pip
python -m pipeline.check_datasets                  # verify datasets against NASA CMR (no login)
python -m pytest pipeline/tests                    # stats unit tests
python -m pipeline.build_all                       # (step 2+) fetch, analyse, write data/processed
cd web && npm install && npm run dev               # (step 2+) web app
```

Earthdata Login is needed from step 2 onward. Put it in `~/.netrc` (`machine urs.earthdata.nasa.gov
login USER password PASS`) or in the `EARTHDATA_USERNAME` / `EARTHDATA_PASSWORD` environment
variables. Credentials are never committed (see `.gitignore`).

Raw NASA subsets are cached in `data/raw/` (gitignored). Small processed outputs in
`data/processed/` are committed, so the web app runs fully offline from static files.

## Team

*to be filled in*

## Use of AI

Space Apps asks teams to disclose how AI tools were used. This project was built as a pair-programming
session between the team and Claude (Anthropic) in Claude Code:

- Claude wrote the initial repo scaffold, the CMR dataset checker, the statistics module and its
  unit tests, and drafts of this README, following a brief written by the team.
- Every dataset short name and version was verified programmatically against NASA CMR, not taken
  from the AI's memory. Where the AI's assumption was wrong (MOD08_M3 version string) the CMR result
  was used.
- All numbers in the app come from the pipeline running on NASA data. No AI-generated or synthetic
  values appear in the app.
- The team reviewed the methods, chose the statistical tests and limitations, and is responsible
  for the scientific interpretation.

No NASA logos or insignia are used.
