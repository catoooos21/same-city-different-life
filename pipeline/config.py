"""Single source of truth for study area, periods and datasets.

Everything the pipeline and the README say about *which* data we use lives here.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_RAW = ROOT / "data" / "raw"              # gitignored cache of NASA subsets
DATA_PROCESSED = ROOT / "data" / "processed"  # small committed outputs read by the web app
DATA_GEO = ROOT / "data" / "geo"              # borders / governorates

# --- Area of interest ---------------------------------------------------------
# (west, south, east, north) in degrees
LAND_BBOX = (46.5, 28.5, 48.5, 30.1)
SEA_BBOX = (47.6, 28.5, 49.0, 30.0)

# --- Periods (full calendar years only) --------------------------------------
LAND_YEARS = (2001, 2025)
SEA_YEARS = (2003, 2025)          # MODIS Aqua starts mid-2002
LAND_BASELINE = (2001, 2010)      # climatology for anomalies
SEA_BASELINE = (2003, 2012)
PREVIEW_YEAR = 2026               # shown greyed out, never used in tests


@dataclass(frozen=True)
class Dataset:
    key: str
    short_name: str
    version: str | None
    daac: str
    variables: tuple[str, ...]
    role: str
    case: str
    years: tuple[int, int]
    bbox: tuple[float, float, float, float]
    granule_pattern: str | None = None  # CMR readable_granule_name wildcard
    doi: str = ""


DATASETS: list[Dataset] = [
    Dataset("mod11c3", "MOD11C3", "061", "LP DAAC",
            ("LST_Day_CMG", "LST_Night_CMG"),
            "Land surface temperature (monthly, 0.05 deg)", "heat", LAND_YEARS, LAND_BBOX,
            doi="10.5067/MODIS/MOD11C3.061"),
    Dataset("m2tmnxslv", "M2TMNXSLV", "5.12.4", "GES DISC",
            ("T2M", "T2MMAX", "T2MMIN"),
            "MERRA-2 monthly 2 m air temperature", "heat", LAND_YEARS, LAND_BBOX,
            doi="10.5067/AP1B0BA5PD2K"),
    Dataset("m2tmnxaer", "M2TMNXAER", "5.12.4", "GES DISC",
            ("DUEXTTAU", "DUSMASS", "TOTEXTTAU"),
            "MERRA-2 monthly aerosol diagnostics", "dust", LAND_YEARS, LAND_BBOX,
            doi="10.5067/FH9A0MLJPC7N"),
    Dataset("mod08_m3", "MOD08_M3", "6.1", "LAADS",
            ("Deep_Blue_Aerosol_Optical_Depth_550_Land_Mean_Mean",),
            "MODIS Terra monthly 1 deg aerosol (satellite cross-check)", "dust", LAND_YEARS, LAND_BBOX,
            doi="10.5067/MODIS/MOD08_M3.061"),
    Dataset("modisa_sst", "MODISA_L3m_SST", "R2019.0", "OB.DAAC",
            ("sst",),
            "MODIS Aqua monthly 4 km sea surface temperature", "sea", SEA_YEARS, SEA_BBOX,
            granule_pattern="*.L3m.MO.SST.sst.4km.nc",
            doi="10.5067/AQUA/MODIS/L3M/SST/2019"),
    Dataset("modisa_chl", "MODISA_L3m_CHL", "2022.0", "OB.DAAC",
            ("chlor_a",),
            "MODIS Aqua monthly 4 km chlorophyll-a", "sea", SEA_YEARS, SEA_BBOX,
            granule_pattern="*.L3m.MO.CHL.chlor_a.4km.nc",
            doi="10.5067/AQUA/MODIS/L3M/CHL/2022"),
    Dataset("m2c0nxasm", "M2C0NXASM", "5.12.4", "GES DISC",
            ("FRLAND", "FROCEAN", "FRLANDICE"),
            "MERRA-2 constants: land/ocean fractions", "mask", (1980, 1980), LAND_BBOX,
            doi="10.5067/ME5QX6Q5IGGU"),
]

# Not in CMR -- checked over plain HTTPS
EXTERNAL_SOURCES = {
    "GISTEMP v4 global annual (GLB.Ts+dSST.csv)":
        "https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv",
    "NASA POWER API (fallback, labelled)":
        "https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=T2M,AOD_55&community=RE&longitude=47.98&latitude=29.37&start=2001&end=2002&format=JSON",
    "Natural Earth admin-0 (10m)":
        "https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_0_countries.zip",
    "geoBoundaries KWT ADM1":
        "https://www.geoboundaries.org/api/current/gbOpen/KWT/ADM1/",
}
