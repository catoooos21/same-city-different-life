"""Regions (Kuwait border, governorates, Kuwait Bay) and area weights on any lat/lon grid.

Weights are *fractional overlap*: for each grid cell we compute the fraction of the cell's area
inside the region polygon, times cos(latitude).  This works for coarse grids (MERRA-2, 0.5 deg)
where a governorate may cover only part of a cell, and reduces to a plain mask on fine grids.
"""
from __future__ import annotations

import json
import zipfile
from dataclasses import dataclass
from functools import lru_cache

import geopandas as gpd
import numpy as np
import xarray as xr
from shapely.geometry import box, mapping
from shapely.ops import unary_union

from pipeline.config import DATA_GEO, DATA_RAW, LAND_BBOX, SEA_BBOX

NE_ZIP = DATA_RAW / "external" / "ne_10m_admin_0_countries.zip"
ADM1_GEOJSON = DATA_RAW / "external" / "kwt_adm1.geojson"


@dataclass(frozen=True)
class Region:
    id: str
    name: str
    name_ar: str
    kind: str  # "land" | "sea"


LAND_REGIONS = [
    Region("all_kuwait", "All Kuwait", "كل الكويت", "land"),
    Region("kuwait_city", "Kuwait City (metro)", "مدينة الكويت", "land"),
    Region("jahra", "Jahra", "الجهراء", "land"),
    Region("ahmadi", "Ahmadi", "الأحمدي", "land"),
]
SEA_REGIONS = [
    Region("all_sea", "Kuwait waters", "مياه الكويت", "sea"),
    Region("kuwait_bay", "Kuwait Bay", "جون الكويت", "sea"),
]

# Metro = the four small urban governorates
METRO_GOVERNORATES = {"Al Asimah", "Hawalli", "Farwaniya", "Mubarak Al-Kabeer"}
KUWAIT_BAY_BOX = (47.6, 29.25, 48.2, 29.75)   # the bay itself, west of Failaka


@lru_cache(maxsize=1)
def kuwait_polygon():
    with zipfile.ZipFile(NE_ZIP) as z:
        shp = [n for n in z.namelist() if n.endswith(".shp")][0]
    gdf = gpd.read_file(f"zip://{NE_ZIP}!{shp}")
    kw = gdf[gdf["ADM0_A3"] == "KWT"]
    assert len(kw) == 1, "Kuwait not found in Natural Earth"
    return kw.geometry.iloc[0]


@lru_cache(maxsize=1)
def governorates():
    return gpd.read_file(ADM1_GEOJSON)


def region_geometry(region_id: str):
    """Shapely geometry for a region id (land polygons or sea boxes)."""
    kw = kuwait_polygon()
    if region_id == "all_kuwait":
        return kw
    gov = governorates()
    if region_id == "kuwait_city":
        return unary_union(gov[gov["shapeName"].isin(METRO_GOVERNORATES)].geometry.values)
    if region_id == "jahra":
        return gov[gov["shapeName"] == "Jahra"].geometry.iloc[0]
    if region_id == "ahmadi":
        return gov[gov["shapeName"] == "Ahmadi"].geometry.iloc[0]
    if region_id == "all_sea":
        return box(*SEA_BBOX).difference(kw)
    if region_id == "kuwait_bay":
        return box(*KUWAIT_BAY_BOX).difference(kw)
    raise KeyError(region_id)


def _cell_edges(coord: np.ndarray):
    c = np.asarray(coord, dtype=float)
    if c.size == 1:
        raise ValueError("need >1 grid points to infer cell size")
    step = np.diff(c)
    edges = np.concatenate([[c[0] - step[0] / 2], (c[:-1] + c[1:]) / 2, [c[-1] + step[-1] / 2]])
    return edges


def overlap_weights(lat: np.ndarray, lon: np.ndarray, geom, cos_lat: bool = True) -> xr.DataArray:
    """(lat, lon) array of fraction-of-cell-inside-geometry * cos(lat).  Zero outside."""
    lat = np.asarray(lat, float)
    lon = np.asarray(lon, float)
    le, lo = _cell_edges(lat), _cell_edges(lon)
    w = np.zeros((lat.size, lon.size))
    prep = geom.buffer(0)
    minx, miny, maxx, maxy = prep.bounds
    for i in range(lat.size):
        if le[i + 1] < miny or le[i] > maxy:
            continue
        for j in range(lon.size):
            if lo[j + 1] < minx or lo[j] > maxx:
                continue
            cell = box(lo[j], le[i], lo[j + 1], le[i + 1])
            inter = cell.intersection(prep).area
            if inter > 0:
                w[i, j] = inter / cell.area
    if cos_lat:
        w *= np.cos(np.deg2rad(lat))[:, None]
    return xr.DataArray(w, coords={"lat": lat, "lon": lon}, dims=("lat", "lon"), name="weight")


def weighted_mean(da: xr.DataArray, weights: xr.DataArray, min_weight_frac: float = 0.5) -> xr.DataArray:
    """Area-weighted mean over (lat, lon), skipping NaN cells.

    A time step is set to NaN if the valid cells carry less than `min_weight_frac` of the total
    weight (so a mostly-cloudy month does not pretend to represent the whole region).
    """
    w = weights.broadcast_like(da)
    valid = da.notnull()
    wsum = (w * valid).sum(("lat", "lon"))
    total = weights.sum()
    mean = (da * w).sum(("lat", "lon"), skipna=True) / wsum
    return mean.where(wsum >= min_weight_frac * total)


def export_geo(out_dir):
    """Write the border and governorates as GeoJSON for the web map."""
    out_dir.mkdir(parents=True, exist_ok=True)
    kw = kuwait_polygon()
    with open(out_dir / "kuwait.geojson", "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": [
            {"type": "Feature", "properties": {"name": "Kuwait", "source": "Natural Earth 10m admin-0"},
             "geometry": mapping(kw)}]}, f)
    gov = governorates()[["shapeName", "geometry"]].rename(columns={"shapeName": "name"})
    gov["source"] = "geoBoundaries gbOpen KWT ADM1"
    gov.to_file(out_dir / "governorates.geojson", driver="GeoJSON")
    feats = []
    for r in SEA_REGIONS:
        feats.append({"type": "Feature", "properties": {"id": r.id, "name": r.name},
                      "geometry": mapping(region_geometry(r.id))})
    with open(out_dir / "sea_regions.geojson", "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": feats}, f)


if __name__ == "__main__":
    for r in LAND_REGIONS + SEA_REGIONS:
        g = region_geometry(r.id)
        print(f"{r.id:12s} area={g.area:.3f} deg2  bounds={tuple(round(b, 2) for b in g.bounds)}")
    export_geo(DATA_GEO)
    print("wrote", DATA_GEO)
