"""NASA GISS GISTEMP v4 global annual mean anomaly (land-ocean), for the 'vs the world' comparison."""
from __future__ import annotations

import io

import numpy as np
import pandas as pd
import requests

from pipeline import stats as S
from pipeline.config import DATA_RAW

URL = "https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv"
CACHE = DATA_RAW / "external" / "GLB.Ts+dSST.csv"


def load() -> pd.Series:
    """Annual (J-D) global anomaly vs 1951-1980 in degC, indexed by year."""
    if not CACHE.exists():
        CACHE.parent.mkdir(parents=True, exist_ok=True)
        r = requests.get(URL, timeout=60, headers={"User-Agent": "ghubar-holmes/0.1"})
        r.raise_for_status()
        CACHE.write_text(r.text, encoding="utf-8")
    txt = CACHE.read_text(encoding="utf-8")
    df = pd.read_csv(io.StringIO(txt), skiprows=1, na_values=["***"])
    s = pd.to_numeric(df["J-D"], errors="coerce")
    s.index = df["Year"].astype(int)
    return s.dropna()


def comparison(kuwait_annual_anomaly: dict, years: tuple[int, int], baseline: tuple[int, int]) -> dict:
    """Re-baseline GISTEMP to our baseline and compare slopes."""
    g = load()
    y0, y1 = years
    g = g[(g.index >= y0) & (g.index <= y1)]
    g = g - g[(g.index >= baseline[0]) & (g.index <= baseline[1])].mean()
    gt = S.annual_trend(g.to_numpy(), g.index.to_numpy())
    kw_years = np.array(kuwait_annual_anomaly["years"])
    kw_vals = np.array([np.nan if v is None else v for v in kuwait_annual_anomaly["values"]], float)
    kt = S.annual_trend(kw_vals, kw_years)
    ratio = None
    if gt is not None and kt is not None and gt.slope_per_decade != 0:
        ratio = kt.slope_per_decade / gt.slope_per_decade
    return {
        "source": "NASA GISS GISTEMP v4, GLB.Ts+dSST.csv (land-ocean, annual J-D)",
        "url": URL,
        "note": f"Global anomalies re-baselined to {baseline[0]}-{baseline[1]} to match Kuwait.",
        "years": g.index.tolist(),
        "anomaly": [round(float(v), 3) for v in g.to_numpy()],
        "trend": None if gt is None else gt.to_dict(),
        "kuwait_slope_per_decade": None if kt is None else kt.slope_per_decade,
        "ratio_kuwait_to_global": None if ratio is None else round(float(ratio), 2),
    }


if __name__ == "__main__":
    s = load()
    print(s.tail())
    t = S.annual_trend(s[(s.index >= 2001) & (s.index <= 2025)].to_numpy(), np.arange(2001, 2026))
    print("global 2001-2025:", t.slope_per_decade, "degC/decade, p=", t.p_value)
