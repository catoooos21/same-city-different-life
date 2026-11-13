"""Earthdata access with earthaccess: search, open, subset to the AOI, cache as NetCDF.

Only the primary path.  If login fails, callers fall back to pipeline.power and label it.

Caching: data/raw/<key>/<short_name>_<version>_<y0>_<y1>.nc holds the AOI subset of the
requested variables for all months, so a rebuild never re-downloads.
"""
from __future__ import annotations

import logging
import re
import sys
import tempfile
from pathlib import Path

import earthaccess
import numpy as np
import pandas as pd
import xarray as xr

from pipeline.config import DATA_RAW, Dataset

log = logging.getLogger(__name__)
_AUTH = None


def login() -> bool:
    """True if Earthdata Login succeeded (netrc or environment)."""
    global _AUTH
    if _AUTH is not None:
        return bool(_AUTH.authenticated)
    for strategy in ("environment", "netrc"):
        try:
            a = earthaccess.login(strategy=strategy)
            if a and a.authenticated:
                _AUTH = a
                return True
        except Exception as e:  # noqa: BLE001
            log.info("login via %s failed: %s", strategy, e)
    return False


def _cache_path(ds: Dataset, y0: int, y1: int) -> Path:
    p = DATA_RAW / ds.key
    p.mkdir(parents=True, exist_ok=True)
    return p / f"{ds.short_name}_{ds.version}_{y0}_{y1}.nc"


def _search(ds: Dataset, y0: int, y1: int):
    q = (earthaccess.DataGranules().short_name(ds.short_name).version(ds.version)
         .temporal(f"{y0}-01-01", f"{y1}-12-31").bounding_box(*ds.bbox))
    if ds.granule_pattern:
        q = q.granule_name(ds.granule_pattern)
    gr = q.get(q.hits())
    # dedupe by file name (OB.DAAC CHL has duplicate CMR records)
    seen, out = set(), []
    for g in gr:
        name = g.data_links()[0].rsplit("/", 1)[-1]
        if name not in seen:
            seen.add(name)
            out.append(g)
    return out


def _subset_bbox(d: xr.Dataset, bbox, lat_name="lat", lon_name="lon") -> xr.Dataset:
    w, s, e, n = bbox
    lat = d[lat_name]
    lat_slice = slice(s, n) if lat[0] < lat[-1] else slice(n, s)
    return d.sel({lat_name: lat_slice, lon_name: slice(w, e)})


def merra2_monthly(ds: Dataset, y0: int, y1: int, bbox_pad: float = 0.7) -> xr.Dataset:
    """MERRA-2 monthly collection subset to AOI (+pad so coarse cells on the edge are kept)."""
    cache = _cache_path(ds, y0, y1)
    if cache.exists():
        return xr.open_dataset(cache)
    if not login():
        raise PermissionError("Earthdata Login unavailable")
    gr = _search(ds, y0, y1)
    log.info("%s: %d granules", ds.short_name, len(gr))
    w, s, e, n = ds.bbox
    bbox = (w - bbox_pad, s - bbox_pad, e + bbox_pad, n + bbox_pad)
    files = earthaccess.open(gr)
    parts = []
    for f in files:
        with xr.open_dataset(f, engine="h5netcdf") as d:
            sub = _subset_bbox(d[list(ds.variables)], bbox).load()
            parts.append(sub)
    out = xr.concat(parts, dim="time").sortby("time")
    out.attrs.update(short_name=ds.short_name, version=ds.version, access="earthdata")
    out.to_netcdf(cache)
    return out


def merra2_constants(ds: Dataset, bbox_pad: float = 0.7) -> xr.Dataset:
    """FRLAND / FROCEAN on the MERRA-2 grid."""
    cache = _cache_path(ds, 1980, 1980)
    if cache.exists():
        return xr.open_dataset(cache)
    if not login():
        raise PermissionError("Earthdata Login unavailable")
    gr = _search(ds, 1980, 1980)
    w, s, e, n = ds.bbox
    f = earthaccess.open(gr[:1])[0]
    with xr.open_dataset(f, engine="h5netcdf") as d:
        out = _subset_bbox(d[list(ds.variables)], (w - bbox_pad, s - bbox_pad, e + bbox_pad, n + bbox_pad)).load()
    out = out.isel(time=0, drop=True) if "time" in out.dims else out
    out.to_netcdf(cache)
    return out


def _hdf4_cmg(path: str, variables: tuple[str, ...], bbox, res: float) -> xr.Dataset:
    """Read MODIS CMG (HDF4-EOS, global, north-to-south) subset with pyhdf."""
    from pyhdf.SD import SD, SDC
    w, s, e, n = bbox
    nlat = int(round(180 / res))
    nlon = int(round(360 / res))
    lats = 90 - res / 2 - res * np.arange(nlat)
    lons = -180 + res / 2 + res * np.arange(nlon)
    i0, i1 = np.searchsorted(-lats, [-n, -s])
    j0, j1 = np.searchsorted(lons, [w, e])
    sd = SD(path, SDC.READ)
    data = {}
    for v in variables:
        obj = sd.select(v)
        arr = obj[i0:i1, j0:j1].astype("float64")
        at = obj.attributes()
        fill = at.get("_FillValue")
        if fill is not None:
            arr[arr == fill] = np.nan
        scale = at.get("scale_factor", 1.0)
        offset = at.get("add_offset", 0.0)
        # MOD11 uses value*scale; MOD08 uses (value-offset)*scale (HDF-EOS convention)
        arr = (arr - offset) * scale
        data[v] = (("lat", "lon"), arr)
    sd.end()
    return xr.Dataset(data, coords={"lat": lats[i0:i1], "lon": lons[j0:j1]})


def modis_cmg_monthly(ds: Dataset, y0: int, y1: int, res: float) -> xr.Dataset:
    """MOD11C3 (res 0.05) or MOD08_M3 (res 1.0): download each monthly HDF4 to a temp dir,
    subset with pyhdf, cache the AOI stack as NetCDF."""
    cache = _cache_path(ds, y0, y1)
    if cache.exists():
        return xr.open_dataset(cache)
    if not login():
        raise PermissionError("Earthdata Login unavailable")
    gr = _search(ds, y0, y1)
    log.info("%s: %d granules", ds.short_name, len(gr))
    pad = res  # one cell of padding
    w, s, e, n = ds.bbox
    bbox = (w - pad, s - pad, e + pad, n + pad)
    parts, times = [], []
    with tempfile.TemporaryDirectory() as tmp:
        for g in gr:
            t0 = g["umm"]["TemporalExtent"]["RangeDateTime"]["BeginningDateTime"][:10]
            t = pd.Timestamp(t0).to_period("M").to_timestamp()
            if t.year < y0 or t.year > y1:
                continue
            local = earthaccess.download([g], tmp, threads=1)[0]
            parts.append(_hdf4_cmg(str(local), ds.variables, bbox, res))
            times.append(t)
            Path(local).unlink(missing_ok=True)
            print(f"\r  {ds.short_name} {t:%Y-%m}", end="", file=sys.stderr)
    print(file=sys.stderr)
    out = xr.concat(parts, dim=pd.Index(times, name="time")).sortby("time")
    if ds.key == "mod11c3":
        for v in ds.variables:
            out[v] = out[v] - 273.15          # K -> degC
            out[v].attrs["units"] = "degC"
    out.attrs.update(short_name=ds.short_name, version=ds.version, access="earthdata")
    out.to_netcdf(cache)
    return out


def obdaac_monthly(ds: Dataset, y0: int, y1: int) -> xr.Dataset:
    """MODIS Aqua L3m 4 km monthly SST or CHL, subset to the sea box, via remote open."""
    cache = _cache_path(ds, y0, y1)
    if cache.exists():
        return xr.open_dataset(cache)
    if not login():
        raise PermissionError("Earthdata Login unavailable")
    gr = _search(ds, y0, y1)
    log.info("%s: %d granules", ds.short_name, len(gr))
    w, s, e, n = ds.bbox
    files = earthaccess.open(gr)
    parts, times = [], []
    for g, f in zip(gr, files):
        name = g.data_links()[0].rsplit("/", 1)[-1]
        m = re.search(r"\.(\d{8})_", name)
        t = pd.Timestamp(m.group(1)).to_period("M").to_timestamp()
        with xr.open_dataset(f, engine="h5netcdf") as d:
            sub = _subset_bbox(d[list(ds.variables)], (w, s, e, n)).load()
        parts.append(sub)
        times.append(t)
        print(f"\r  {ds.short_name} {t:%Y-%m}", end="", file=sys.stderr)
    print(file=sys.stderr)
    out = xr.concat(parts, dim=pd.Index(times, name="time")).sortby("time")
    out.attrs.update(short_name=ds.short_name, version=ds.version, access="earthdata")
    out.to_netcdf(cache)
    return out
