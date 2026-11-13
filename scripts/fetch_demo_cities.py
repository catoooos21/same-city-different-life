"""Fetch the demo cities from NASA POWER and store compact copies in web/public/demo/.

The web app works for any city by calling POWER from the browser; the demo copies only make the
first click instant and keep the demo working offline. Re-run to refresh.

Usage: .venv/Scripts/python scripts/fetch_demo_cities.py
"""
from __future__ import annotations

import json
import time
from datetime import date, timedelta
from pathlib import Path

import requests

URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
PARAMS = ["T2M_MAX", "T2M_MIN", "T2M", "T2MDEW", "PRECTOTCORR", "RH2M"]
FIRST, LAST = 1981, 2025
# Keep in sync with DEMO_CITIES in web/src/power.ts
CITIES = [
    ("kuwait-city", "Kuwait City", 29.3759, 47.9774),
    ("london", "London", 51.5085, -0.1257),
    ("sydney", "Sydney", -33.8679, 151.2073),
    ("delhi", "Delhi", 28.6519, 77.2315),
]
OUT = Path(__file__).resolve().parent.parent / "web" / "public" / "demo"


def fetch(lat: float, lon: float) -> dict:
    q = dict(parameters=",".join(PARAMS), community="AG", longitude=lon, latitude=lat,
             start=f"{FIRST}0101", end=f"{LAST}1231", format="JSON")
    for attempt in range(4):
        r = requests.get(URL, params=q, timeout=180)
        if r.ok:
            return r.json()
        time.sleep(5 * (attempt + 1))
    r.raise_for_status()
    raise RuntimeError("unreachable")


def compact(j: dict) -> dict:
    fill = j["header"].get("fill_value", -999)
    d0 = date(FIRST, 1, 1)
    n = (date(LAST, 12, 31) - d0).days + 1
    values = {}
    for p in PARAMS:
        s = j["properties"]["parameter"][p]
        arr = [None] * n
        for k, v in s.items():
            i = (date(int(k[:4]), int(k[4:6]), int(k[6:8])) - d0).days
            if 0 <= i < n and v is not None and v != fill:
                arr[i] = round(v, 2)
        values[p] = arr
    return {
        "header": {"start": j["header"]["start"], "end": j["header"]["end"], "sources": j["header"].get("sources"),
                   "api": j["header"].get("api", {}).get("version")},
        "fetchedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "values": values,
    }


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for cid, name, lat, lon in CITIES:
        t = time.time()
        j = fetch(lat, lon)
        c = compact(j)
        c.update(id=cid, name=name, lat=lat, lon=lon)
        f = OUT / f"{cid}.json"
        f.write_text(json.dumps(c, separators=(",", ":")), encoding="utf-8")
        miss = {p: sum(v is None for v in c["values"][p]) for p in PARAMS}
        print(f"{name:12s} {time.time()-t:4.1f}s  {f.stat().st_size/1024:5.0f} KB  missing days: {miss}")
