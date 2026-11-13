"""Trend statistics used by every case.

All functions take plain numpy arrays / pandas objects and return plain dicts so that
results serialise straight to JSON.  Nothing in here touches NASA data; that keeps the
module testable with synthetic series (tests only -- the app never sees synthetic data).

Methods
-------
* Mann-Kendall with Hamed & Rao (1998) autocorrelation correction  -> is there a monotonic trend?
* Sen's slope with 95 % CI (Theil-Sen, scipy.stats.theilslopes)       -> how much per year?
* Seasonal Kendall (period 12) on monthly anomalies                   -> robust to seasonality
* Benjamini-Hochberg FDR across grid cells                            -> honest maps
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Literal

import numpy as np
import pandas as pd
import pymannkendall as mk
from scipy import stats

Verdict = Literal["Significant increase", "Significant decrease", "No significant trend"]

ALPHA = 0.05
MIN_YEARS = 10


@dataclass
class TrendResult:
    n: int
    slope_per_year: float
    slope_per_decade: float
    ci95_per_decade: tuple[float, float]
    intercept: float
    total_change: float          # slope * (n - 1) years
    pct_change_vs_baseline: float | None
    p_value: float
    z: float
    tau: float
    test: str
    verdict: Verdict
    significant: bool

    def to_dict(self) -> dict:
        d = asdict(self)
        d["ci95_per_decade"] = list(self.ci95_per_decade)
        return d


def _verdict(p: float, slope: float, alpha: float = ALPHA) -> tuple[Verdict, bool]:
    if p < alpha and slope > 0:
        return "Significant increase", True
    if p < alpha and slope < 0:
        return "Significant decrease", True
    return "No significant trend", False


def annual_trend(values, years=None, baseline_mean: float | None = None,
                 alpha: float = ALPHA) -> TrendResult | None:
    """MK (Hamed-Rao) + Sen's slope on an annual series.

    values : 1-D array of annual means (NaN allowed; dropped pairwise with years)
    years  : matching years; defaults to 0..n-1 (slope is then per step = per year)
    baseline_mean : if given, total change is also expressed as % of this value
    Returns None if fewer than MIN_YEARS valid points.
    """
    y = np.asarray(values, dtype=float)
    x = np.arange(len(y), dtype=float) if years is None else np.asarray(years, dtype=float)
    ok = np.isfinite(y) & np.isfinite(x)
    y, x = y[ok], x[ok]
    if y.size < MIN_YEARS:
        return None

    res = mk.hamed_rao_modification_test(y, alpha=alpha)
    test_name = "Mann-Kendall (Hamed-Rao) + Sen's slope"
    if not np.isfinite(res.p):
        # The autocorrelation correction can make the variance negative on noisy
        # series; fall back to the uncorrected test and say so.
        res = mk.original_test(y, alpha=alpha)
        test_name = "Mann-Kendall (original; Hamed-Rao variance undefined) + Sen's slope"
    slope, intercept, lo, hi = stats.theilslopes(y, x, alpha=0.95)
    span = x.max() - x.min()
    total = slope * span
    pct = None
    if baseline_mean is not None and np.isfinite(baseline_mean) and baseline_mean != 0:
        pct = 100.0 * total / baseline_mean
    verdict, sig = _verdict(res.p, slope, alpha)
    return TrendResult(
        n=int(y.size),
        slope_per_year=float(slope),
        slope_per_decade=float(slope * 10),
        ci95_per_decade=(float(lo * 10), float(hi * 10)),
        intercept=float(intercept),
        total_change=float(total),
        pct_change_vs_baseline=None if pct is None else float(pct),
        p_value=float(res.p),
        z=float(res.z),
        tau=float(res.Tau),
        test=test_name,
        verdict=verdict,
        significant=sig,
    )


def seasonal_trend(monthly: pd.Series, alpha: float = ALPHA) -> dict | None:
    """Seasonal Kendall test (period 12) on a monthly series indexed by Timestamp."""
    s = monthly.dropna()
    if s.size < 12 * MIN_YEARS:
        return None
    # pymannkendall expects a regular series; reindex to a full monthly range and
    # let it skip NaN internally.
    full = monthly.reindex(pd.date_range(monthly.index.min(), monthly.index.max(), freq="MS"))
    res = mk.seasonal_test(full.to_numpy(dtype=float), period=12, alpha=alpha)
    verdict, sig = _verdict(res.p, res.slope, alpha)
    return {
        "n_months": int(s.size),
        "slope_per_year": float(res.slope),      # pymannkendall seasonal slope is per period (year)
        "slope_per_decade": float(res.slope * 10),
        "p_value": float(res.p),
        "z": float(res.z),
        "tau": float(res.Tau),
        "test": "Seasonal Kendall (period 12)",
        "verdict": verdict,
        "significant": sig,
    }


def per_month_trends(monthly: pd.Series, alpha: float = ALPHA) -> dict[int, dict]:
    """Trend of each calendar month across years, e.g. 'are Augusts warming faster?'"""
    out = {}
    for m in range(1, 13):
        sub = monthly[monthly.index.month == m]
        r = annual_trend(sub.to_numpy(), sub.index.year.to_numpy(), alpha=alpha)
        out[m] = None if r is None else {
            "slope_per_decade": r.slope_per_decade, "p_value": r.p_value,
            "significant": r.significant, "n": r.n,
        }
    return out


def anomalies(monthly: pd.Series, baseline: tuple[int, int]) -> tuple[pd.Series, pd.Series]:
    """Monthly anomalies vs a month-of-year climatology computed over `baseline` years.

    Returns (anomaly series, 12-value climatology indexed 1..12).
    """
    base = monthly[(monthly.index.year >= baseline[0]) & (monthly.index.year <= baseline[1])]
    clim = base.groupby(base.index.month).mean()
    clim.index.name = "month"
    anom = monthly - clim.reindex(monthly.index.month).to_numpy()
    return anom, clim


def annual_means(monthly: pd.Series, min_months: int = 10) -> pd.Series:
    """Calendar-year means; years with fewer than `min_months` valid months become NaN."""
    g = monthly.groupby(monthly.index.year)
    mean = g.mean()
    count = g.count()
    mean[count < min_months] = np.nan
    mean.index.name = "year"
    return mean


def bh_fdr(p_values, q: float = 0.05) -> np.ndarray:
    """Benjamini-Hochberg: boolean mask of rejections at FDR level q (NaN p -> False)."""
    p = np.asarray(p_values, dtype=float)
    out = np.zeros(p.shape, dtype=bool)
    flat = p.ravel()
    ok = np.isfinite(flat)
    pv = flat[ok]
    m = pv.size
    if m == 0:
        return out
    order = np.argsort(pv)
    ranked = pv[order]
    thresh = q * (np.arange(1, m + 1) / m)
    below = np.nonzero(ranked <= thresh)[0]
    rej = np.zeros(m, dtype=bool)
    if below.size:
        rej[order[: below.max() + 1]] = True
    tmp = np.zeros(flat.shape, dtype=bool)
    tmp[ok] = rej
    return tmp.reshape(p.shape)


def grid_trends(cube: np.ndarray, years: np.ndarray, q: float = 0.05, min_years: int = MIN_YEARS):
    """Per-pixel MK + Sen's slope on a (year, lat, lon) cube, then BH-FDR across pixels.

    Returns dict of 2-D arrays: slope_per_decade, p_value, significant (FDR), n.
    """
    ny, nlat, nlon = cube.shape
    slope = np.full((nlat, nlon), np.nan)
    pval = np.full((nlat, nlon), np.nan)
    nval = np.zeros((nlat, nlon), dtype=int)
    for i in range(nlat):
        for j in range(nlon):
            series = cube[:, i, j]
            ok = np.isfinite(series)
            nval[i, j] = ok.sum()
            if ok.sum() < min_years:
                continue
            r = annual_trend(series[ok], years[ok])
            if r is None:
                continue
            slope[i, j] = r.slope_per_decade
            pval[i, j] = r.p_value
    sig = bh_fdr(pval, q=q)
    return {"slope_per_decade": slope, "p_value": pval, "significant": sig, "n": nval}


def pearson_with_ci(x, y) -> dict | None:
    """Pearson r with Fisher-z 95 % CI and Spearman rho, for the Connected case."""
    x = np.asarray(x, float)
    y = np.asarray(y, float)
    ok = np.isfinite(x) & np.isfinite(y)
    x, y = x[ok], y[ok]
    n = x.size
    if n < MIN_YEARS:
        return None
    r, p = stats.pearsonr(x, y)
    z = np.arctanh(r)
    se = 1 / np.sqrt(n - 3)
    lo, hi = np.tanh(z - 1.96 * se), np.tanh(z + 1.96 * se)
    rho, p_rho = stats.spearmanr(x, y)
    return {"n": int(n), "pearson_r": float(r), "pearson_p": float(p),
            "r_ci95": [float(lo), float(hi)], "spearman_rho": float(rho),
            "spearman_p": float(p_rho)}
