# Data contract: pipeline -> web app

Everything the web app shows comes from `data/processed/`. The app never computes statistics; it
only renders what is here. Files are small (tens of kB) and committed.

```
data/processed/
  index.json                      # list of cases, regions, build time, data source status
  cases/<case>/<region>.json      # one file per case x region (see below)
  maps/<case>_<variable>.json     # per-pixel trend grid for the map layer
  geo/kuwait.geojson              # border (Natural Earth admin-0)
  geo/governorates.geojson        # geoBoundaries ADM1
```

## index.json

```json
{
  "built_at": "2026-11-13T19:00:00Z",
  "cases": [
    {"id": "heat", "title": "The Heat Case", "question": "Is Kuwait heating up, and faster than the world?",
     "status": "ok" | "data_unavailable", "regions": ["all_kuwait", "kuwait_city", "jahra", "ahmadi"]}
  ],
  "sources": [ {"id": "m2tmnxslv", "short_name": "M2TMNXSLV", "version": "5.12.4", "status": "ok" | "fallback" | "unavailable", "note": "..."} ]
}
```

## cases/<case>/<region>.json

```json
{
  "case": "heat",
  "region": {"id": "all_kuwait", "name": "All Kuwait", "name_ar": "الكويت"},
  "period": {"start": 2001, "end": 2025, "baseline": [2001, 2010]},
  "variables": [
    {
      "id": "t2m",
      "label": "Air temperature (2 m)",
      "unit": "°C",
      "source": {"short_name": "M2TMNXSLV", "version": "5.12.4", "variable": "T2M", "doi": "...",
                 "access": "earthdata" | "power_fallback"},
      "annual": {"years": [2001, ...], "values": [26.1, ...]},
      "monthly_anomaly": {"dates": ["2001-01", ...], "values": [-0.4, ...]},
      "climatology": [12 numbers, Jan..Dec],
      "heat_strip": {"years": [...], "months": [1..12], "values": [[...12 per year...]]},
      "trend": {  "n": 25, "slope_per_decade": 0.52, "ci95_per_decade": [0.21, 0.83],
                  "total_change": 1.25, "pct_change_vs_baseline": 4.6, "p_value": 0.003,
                  "intercept": ..., "test": "...", "verdict": "Significant increase", "significant": true },
      "seasonal_kendall": { "slope_per_decade": ..., "p_value": ..., "verdict": ..., "significant": ... },
      "per_month_trends": {"1": {"slope_per_decade": ..., "p_value": ..., "significant": true}, ...},
      "preview_2026": {"dates": [...], "values": [...]}   // optional, greyed out in the app
    }
  ],
  "comparison": {  // heat case only
    "global": {"source": "GISTEMP v4", "years": [...], "anomaly": [...], "slope_per_decade": 0.23,
               "p_value": ..., "ratio_kuwait_to_global": 2.3}
  },
  "verdict": {
    "headline": "Significant increase",
    "stamp": "CASE CLOSED" | "INCONCLUSIVE",
    "what": "...", "where": "...", "how_much": "...", "significant": "...",
    "text": "one paragraph in plain English",
    "text_ar": "optional Arabic"
  },
  "evidence": ["bullet", ...],          // dataset names + method, short
  "limitations": ["bullet", ...]
}
```

Rules:
- Values are numbers or `null` (never NaN in JSON).
- `verdict.headline` is exactly one of "Significant increase", "Significant decrease",
  "No significant trend".
- If a variable's data could not be fetched, the variable is omitted and `index.json` marks the
  source `unavailable`; the app shows "data unavailable" for it. Nothing is ever filled in.

## maps/<case>_<variable>.json

```json
{
  "case": "heat", "variable": "t2m", "unit_per_decade": "°C/decade",
  "lon": [46.5, 47.0, ...], "lat": [28.5, 29.0, ...],     // cell centres
  "slope_per_decade": [[row per lat...]], "p_value": [[...]], "significant": [[true/false]],
  "n": [[...]], "fdr_q": 0.05, "source": {...}
}
```
