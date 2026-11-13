"""Unit tests for pipeline.stats using synthetic series with KNOWN trends.

Synthetic data is allowed here and only here.
"""
import numpy as np
import pandas as pd
import pytest

from pipeline import stats as S

rng = np.random.default_rng(42)


def test_annual_trend_detects_known_positive_slope():
    years = np.arange(2001, 2026)
    y = 30 + 0.05 * (years - 2001) + rng.normal(0, 0.15, years.size)  # +0.5 degC / decade
    r = S.annual_trend(y, years, baseline_mean=30.0)
    assert r is not None
    assert r.verdict == "Significant increase"
    assert 0.3 < r.slope_per_decade < 0.7
    assert r.ci95_per_decade[0] < r.slope_per_decade < r.ci95_per_decade[1]
    assert r.p_value < 0.05
    assert r.n == 25
    assert abs(r.total_change - 0.05 * 24) < 0.25
    assert r.pct_change_vs_baseline == pytest.approx(100 * r.total_change / 30.0)


def test_annual_trend_detects_decrease():
    years = np.arange(2001, 2026)
    y = 0.4 - 0.004 * (years - 2001) + rng.normal(0, 0.005, years.size)
    r = S.annual_trend(y, years)
    assert r.verdict == "Significant decrease"
    assert r.slope_per_decade < 0


def test_annual_trend_no_trend_on_noise():
    years = np.arange(2001, 2026)
    hits = 0
    for _ in range(50):
        y = rng.normal(0, 1, years.size)
        r = S.annual_trend(y, years)
        hits += r.significant
    # false-positive rate should be around alpha, certainly well below 30 %
    assert hits <= 15


def test_annual_trend_too_short_returns_none():
    assert S.annual_trend(np.arange(5), np.arange(5)) is None


def test_annual_trend_handles_nan():
    years = np.arange(2001, 2026)
    y = 1.0 * (years - 2001)
    y[[3, 10]] = np.nan
    r = S.annual_trend(y, years)
    assert r.n == 23
    assert r.slope_per_year == pytest.approx(1.0)


def test_seasonal_and_anomalies():
    idx = pd.date_range("2001-01-01", "2025-12-01", freq="MS")
    t = (idx.year - 2001) + (idx.month - 1) / 12
    season = 10 * np.sin(2 * np.pi * (idx.month - 1) / 12)
    series = pd.Series(25 + season + 0.06 * t + rng.normal(0, 0.3, idx.size), index=idx)

    anom, clim = S.anomalies(series, (2001, 2010))
    assert clim.size == 12
    # the seasonal cycle should be gone from the anomalies
    assert anom.groupby(anom.index.month).mean().std() < 0.3

    r = S.seasonal_trend(series)
    assert r["significant"] and r["verdict"] == "Significant increase"
    assert 0.4 < r["slope_per_decade"] < 0.8

    ann = S.annual_means(series)
    assert ann.index[0] == 2001 and ann.size == 25
    pm = S.per_month_trends(anom)
    assert len(pm) == 12 and pm[7]["n"] == 25


def test_annual_means_min_months():
    idx = pd.date_range("2001-01-01", "2002-12-01", freq="MS")
    s = pd.Series(1.0, index=idx)
    s.iloc[:6] = np.nan  # 2001 has only 6 months
    ann = S.annual_means(s)
    assert np.isnan(ann.loc[2001]) and ann.loc[2002] == 1.0


def test_bh_fdr_controls_false_discoveries():
    p = np.concatenate([np.full(20, 1e-6), rng.uniform(0, 1, 980)])
    rej = S.bh_fdr(p, q=0.05)
    assert rej[:20].all()
    # of the 980 nulls, expect very few rejections
    assert rej[20:].sum() <= 10
    assert S.bh_fdr(np.array([np.nan, 0.001])).tolist() == [False, True]


def test_grid_trends_marks_only_trending_cells():
    years = np.arange(2001, 2026)
    cube = rng.normal(0, 1, (25, 6, 6))
    cube[:, :3, :] += 0.3 * (years - 2001)[:, None, None]   # strong trend in the top half
    cube[:, 5, 5] = np.nan                                  # a missing pixel
    g = S.grid_trends(cube, years)
    assert g["significant"][:3, :].all()
    assert not g["significant"][3:, :].any()
    assert np.isnan(g["slope_per_decade"][5, 5]) and g["n"][5, 5] == 0
    assert np.allclose(g["slope_per_decade"][:3, :], 3.0, atol=0.8)


def test_pearson_with_ci():
    x = rng.normal(0, 1, 25)
    y = 2 * x + rng.normal(0, 0.5, 25)
    r = S.pearson_with_ci(x, y)
    assert r["pearson_r"] > 0.9 and r["pearson_p"] < 1e-6
    assert r["r_ci95"][0] < r["pearson_r"] < r["r_ci95"][1]
    assert S.pearson_with_ci(x[:5], y[:5]) is None
