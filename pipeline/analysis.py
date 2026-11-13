"""Turn a (time, lat, lon) monthly grid + region weights into the JSON 'variable' block.

See docs/data_contract.md.  This is the only place where the statistics module meets the data.
"""
from __future__ import annotations

import math

import numpy as np
import pandas as pd
import xarray as xr

from pipeline import stats as S
from pipeline.config import PREVIEW_YEAR
from pipeline.regions import weighted_mean


def _clean(x):
    """Recursively convert numpy / NaN to JSON-safe python values."""
    if isinstance(x, dict):
        return {str(k): _clean(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [_clean(v) for v in x]
    if isinstance(x, np.ndarray):
        return _clean(x.tolist())
    if isinstance(x, (np.integer,)):
        return int(x)
    if isinstance(x, (float, np.floating)):
        return None if not math.isfinite(float(x)) else round(float(x), 5)
    if isinstance(x, (np.bool_,)):
        return bool(x)
    return x


def regional_series(da: xr.DataArray, weights: xr.DataArray) -> pd.Series:
    s = weighted_mean(da, weights).to_series()
    s.index = pd.DatetimeIndex(s.index).to_period("M").to_timestamp()
    return s.sort_index()


def analyze_series(monthly: pd.Series, years: tuple[int, int], baseline: tuple[int, int],
                   log10: bool = False) -> dict:
    """Full trend analysis of a regional monthly series.  Returns contract fields (no source/label)."""
    y0, y1 = years
    s = monthly.copy()
    if log10:
        s = np.log10(s.where(s > 0))
    preview = s[s.index.year == PREVIEW_YEAR]
    s = s[(s.index.year >= y0) & (s.index.year <= y1)]
    s = s.reindex(pd.date_range(f"{y0}-01-01", f"{y1}-12-01", freq="MS"))

    anom, clim = S.anomalies(s, baseline)
    annual = S.annual_means(s)
    annual_anom = S.annual_means(anom)
    base_mean = float(s[(s.index.year >= baseline[0]) & (s.index.year <= baseline[1])].mean())

    trend = S.annual_trend(annual.to_numpy(), annual.index.to_numpy(), baseline_mean=base_mean)
    sk = S.seasonal_trend(anom)
    pm = S.per_month_trends(anom)

    strip = np.full((y1 - y0 + 1, 12), np.nan)
    for ts, v in anom.items():
        strip[ts.year - y0, ts.month - 1] = v

    out = {
        "log10": log10,
        "annual": {"years": annual.index.tolist(), "values": annual.to_numpy()},
        "annual_anomaly": {"years": annual_anom.index.tolist(), "values": annual_anom.to_numpy()},
        "monthly_anomaly": {"dates": [d.strftime("%Y-%m") for d in anom.index], "values": anom.to_numpy()},
        "monthly": {"dates": [d.strftime("%Y-%m") for d in s.index], "values": s.to_numpy()},
        "climatology": clim.reindex(range(1, 13)).to_numpy(),
        "baseline_mean": base_mean,
        "heat_strip": {"years": list(range(y0, y1 + 1)), "months": list(range(1, 13)), "values": strip},
        "trend": None if trend is None else trend.to_dict(),
        "seasonal_kendall": sk,
        "per_month_trends": pm,
    }
    if preview.size:
        out["preview_2026"] = {"dates": [d.strftime("%Y-%m") for d in preview.index],
                               "values": preview.to_numpy(),
                               "anomaly": (preview - clim.reindex(preview.index.month).to_numpy()).to_numpy()}
    return _clean(out)


def grid_trend_block(da: xr.DataArray, years: tuple[int, int], mask: xr.DataArray | None = None,
                     log10: bool = False, min_months: int = 10) -> dict:
    """Per-pixel annual means -> MK/Sen -> BH-FDR.  `mask` (lat, lon) True keeps a cell."""
    y0, y1 = years
    d = da.sel(time=slice(f"{y0}-01-01", f"{y1}-12-31"))
    if log10:
        d = np.log10(d.where(d > 0))
    grp = d.groupby("time.year")
    ann = grp.mean("time")
    cnt = grp.count("time")
    ann = ann.where(cnt >= min_months)
    if mask is not None:
        ann = ann.where(mask)
    cube = ann.transpose("year", "lat", "lon").to_numpy()
    g = S.grid_trends(cube, ann["year"].to_numpy())
    return _clean({
        "lon": da["lon"].to_numpy(), "lat": da["lat"].to_numpy(),
        "slope_per_decade": g["slope_per_decade"], "p_value": g["p_value"],
        "significant": g["significant"], "n": g["n"], "fdr_q": 0.05, "log10": log10,
        "n_cells": int(np.isfinite(g["p_value"]).sum()),
        "n_significant": int(g["significant"].sum()),
        "n_sig_increase": int((g["significant"] & (g["slope_per_decade"] > 0)).sum()),
        "n_sig_decrease": int((g["significant"] & (g["slope_per_decade"] < 0)).sum()),
    })
