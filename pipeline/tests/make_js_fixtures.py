"""Generate reference values for the JavaScript statistics port.

Writes web/src/__tests__/fixtures.json with series and the results of the Python reference
implementations (pymannkendall Hamed-Rao test, scipy theilslopes). The vitest suite then checks
that web/src/stats.ts reproduces them.

Run:  .venv/Scripts/python -m pipeline.tests.make_js_fixtures
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pymannkendall as mk
from scipy import stats

OUT = Path(__file__).resolve().parents[2] / "web" / "src" / "__tests__" / "fixtures.json"


def case(name: str, years: list[int], values: list[float]) -> dict:
    y = np.asarray(values, dtype=float)
    x = np.asarray(years, dtype=float)
    hr = mk.hamed_rao_modification_test(y)
    orig = mk.original_test(y)
    ts = stats.theilslopes(y, x, 0.95, method="separate")
    return {
        "name": name,
        "years": years,
        "values": values,
        "hamed_rao": {"s": float(hr.s), "var_s": float(hr.var_s), "z": float(hr.z), "tau": float(hr.Tau), "p": float(hr.p), "h": bool(hr.h), "slope": float(hr.slope), "intercept": float(hr.intercept)},
        "original": {"p": float(orig.p), "z": float(orig.z), "var_s": float(orig.var_s)},
        "theilslopes": {"slope": float(ts.slope), "intercept": float(ts.intercept), "low": float(ts.low_slope), "high": float(ts.high_slope)},
    }


rng = np.random.default_rng(42)
years = list(range(1981, 2026))
n = len(years)

cases = []
# 1. noisy linear trend
cases.append(case("linear_trend_noise", years, list(np.round(10 + 0.4 * np.arange(n) + rng.normal(0, 3, n), 3))))
# 2. integer counts with many ties (like "days per year")
cases.append(case("poisson_counts_ties", years, [int(v) for v in rng.poisson(8 + 0.3 * np.arange(n))]))
# 3. strongly autocorrelated AR(1) with trend -> Hamed-Rao correction kicks in
ar = np.zeros(n)
for i in range(1, n):
    ar[i] = 0.8 * ar[i - 1] + rng.normal(0, 1)
cases.append(case("ar1_autocorrelated", years, list(np.round(20 + 0.2 * np.arange(n) + 3 * ar, 3))))
# 4. pure noise, no trend
cases.append(case("white_noise", years, list(np.round(rng.normal(50, 5, n), 3))))
# 5. short series (minimum length)
cases.append(case("short_12", years[:12], list(np.round(rng.normal(0, 1, 12) + 0.5 * np.arange(12), 3))))
# 6. gaps: some years dropped (uneven x)
keep = [i for i in range(n) if i not in (3, 10, 11, 27, 40)]
cases.append(case("with_gaps", [years[i] for i in keep], [float(v) for v in np.round(5 + 0.25 * np.array(keep) + rng.normal(0, 2, len(keep)), 3)]))
# 7. all-zero series except a few (frost days in a warm city)
z = np.zeros(n, dtype=int)
z[[2, 5, 9]] = [1, 2, 1]
cases.append(case("mostly_zero", years, [int(v) for v in z]))
# 8. the real Kuwait hot-days series if the raw cache from the probe exists
probe = Path(r"C:\Users\Admin\AppData\Local\Temp\claude\2667eb7b538ada6b\d94b81ca-dc4f-4b22-a119-c7a2c552646f\scratchpad\kuwait_daily.json")
if probe.exists():
    import pandas as pd

    j = json.loads(probe.read_text())
    s = pd.Series(j["properties"]["parameter"]["T2M_MAX"])
    s.index = pd.to_datetime(s.index, format="%Y%m%d")
    s = s.replace(-999.0, np.nan)
    p90 = s.loc["1981":"2010"].quantile(0.9)
    hot = s.groupby(s.index.year).apply(lambda g: int((g > p90).sum()))
    cases.append(case("kuwait_hot_days", [int(y) for y in hot.index], [int(v) for v in hot.values]))

# percentile reference (numpy default linear interpolation)
pct_vals = list(np.round(rng.normal(30, 8, 101), 3))
percentiles = {"values": pct_vals, "p90": float(np.percentile(pct_vals, 90)), "p50": float(np.percentile(pct_vals, 50))}

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps({"cases": cases, "percentiles": percentiles}, indent=1), encoding="utf-8")
print(f"wrote {len(cases)} cases -> {OUT}")
for c in cases:
    print(f"  {c['name']:24s} p={c['hamed_rao']['p']:.4g} slope={c['theilslopes']['slope']:+.4f} CI=({c['theilslopes']['low']:+.4f},{c['theilslopes']['high']:+.4f})")
