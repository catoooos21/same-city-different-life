"""NASA POWER regional monthly API -- the login-free FALLBACK.

Used only when Earthdata access is unavailable, and every output built from it is labelled
`access: power_fallback`.  POWER serves MERRA-2 meteorology (T2M, T2M_MAX, T2M_MIN) on the native
MERRA-2 grid (0.5 x 0.625 deg) and aerosol optical depth AOD_55 from CERES SYN1deg (1 deg).

Docs: https://power.larc.nasa.gov/docs/services/api/temporal/monthly/
Limits: one parameter per request, >= 2 deg latitude span, monthly values keyed YYYYMM;
key YYYY13 is the annual mean (dropped here). Fill value -999.
"""
from __future__ import annotations

import json
import time
from pathlib import Path

import numpy as np
import pandas as pd
import requests
import xarray as xr

from pipeline.config import DATA_RAW

POWER_URL = "https://power.larc.nasa.gov/api/temporal/monthly/regional"
POWER_BBOX = (46.5, 28.5, 48.5, 30.5)   # 2 deg lat span required by the API
CACHE = DATA_RAW / "power"

SOURCE_LABEL = {
    "T2M": "MERRA-2 via NASA POWER",
    "T2M_MAX": "MERRA-2 via NASA POWER",
    "T2M_MIN": "MERRA-2 via NASA POWER",
    "AOD_55": "CERES SYN1deg via NASA POWER",
}


def _fetch(parameter: str, start: int, end: int, bbox=POWER_BBOX) -> dict:
    CACHE.mkdir(parents=True, exist_ok=True)
    f = CACHE / f"{parameter}_{start}_{end}.json"
    if f.exists():
        return json.loads(f.read_text(encoding="utf-8"))
    params = {
        "parameters": parameter, "community": "RE", "format": "JSON",
        "longitude-min": bbox[0], "longitude-max": bbox[2],
        "latitude-min": bbox[1], "latitude-max": bbox[3],
        "start": start, "end": end,
    }
    for attempt in range(4):
        r = requests.get(POWER_URL, params=params, timeout=120,
                         headers={"User-Agent": "ghubar-holmes/0.1"})
        if r.ok and "features" in r.json():
            f.write_text(r.text, encoding="utf-8")
            return r.json()
        time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"POWER request failed for {parameter}: {r.status_code} {r.text[:200]}")


def monthly_grid(parameter: str, start: int, end: int) -> xr.DataArray:
    """(time, lat, lon) DataArray of monthly values from POWER, NaN where fill."""
    d = _fetch(parameter, start, end)
    pts = {}
    for ft in d["features"]:
        lon, lat = ft["geometry"]["coordinates"][:2]
        series = ft["properties"]["parameter"][parameter]
        pts[(lat, lon)] = {k: v for k, v in series.items() if not k.endswith("13")}
    lats = sorted({k[0] for k in pts})
    lons = sorted({k[1] for k in pts})
    keys = sorted(next(iter(pts.values())).keys())
    times = pd.to_datetime(keys, format="%Y%m")
    arr = np.full((len(keys), len(lats), len(lons)), np.nan)
    for (lat, lon), s in pts.items():
        i, j = lats.index(lat), lons.index(lon)
        arr[:, i, j] = [s.get(k, np.nan) for k in keys]
    fill = d.get("header", {}).get("fill_value", -999.0)
    arr[arr == fill] = np.nan
    da = xr.DataArray(arr, coords={"time": times, "lat": lats, "lon": lons},
                      dims=("time", "lat", "lon"), name=parameter)
    da.attrs.update(source=SOURCE_LABEL.get(parameter, "NASA POWER"),
                    access="power_fallback", units=d.get("parameters", {}).get(parameter, {}).get("units", ""))
    return da


if __name__ == "__main__":
    da = monthly_grid("T2M", 2001, 2002)
    print(da)
