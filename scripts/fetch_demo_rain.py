"""Fetch satellite rain (GPM IMERG) and model rain (MERRA-2) for the demo cities from NASA POWER.

Used by "A second opinion on rain" in the web app. The app fetches the same thing live for any
other city; these copies keep the demo cities working offline. Re-run to refresh.

Facts checked with real requests on 2026-11-14:
  - IMERG_PRECTOT is only served with time-standard=utc (local solar time returns fill values)
  - it starts on 1998-01-01; earlier dates are fill values
  - PRECTOTCORR is requested in UTC too, so both sources count the same days

Usage: python scripts/fetch_demo_rain.py     (standard library only)
"""
from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
PARAMS = ["IMERG_PRECTOT", "PRECTOTCORR"]
FIRST, LAST = 1998, 2025
# Keep in sync with DEMO_CITIES in web/src/power.ts
CITIES = [
    ("kuwait-city", "Kuwait City", 29.3759, 47.9774),
    ("london", "London", 51.5085, -0.1257),
    ("sydney", "Sydney", -33.8679, 151.2073),
    ("delhi", "Delhi", 28.6519, 77.2315),
]
OUT = Path(__file__).resolve().parent.parent / "web" / "public" / "demo"


def fetch(lat: float, lon: float) -> dict:
    q = urllib.parse.urlencode({
        "parameters": ",".join(PARAMS), "community": "AG", "longitude": lon, "latitude": lat,
        "start": f"{FIRST}0101", "end": f"{LAST}1231", "format": "JSON", "time-standard": "utc",
    })
    last_error: Exception | None = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(f"{URL}?{q}", timeout=180) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001 - retry on any network error
            last_error = e
            time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"NASA POWER did not answer: {last_error}")


def compact(j: dict) -> dict:
    fill = j["header"].get("fill_value", -999)
    d0 = date(FIRST, 1, 1)
    n = (date(LAST, 12, 31) - d0).days + 1
    values = {}
    for p in PARAMS:
        s = j["properties"]["parameter"][p]
        arr: list[float | None] = [None] * n
        for k, v in s.items():
            i = (date(int(k[:4]), int(k[4:6]), int(k[6:8])) - d0).days
            if 0 <= i < n and v is not None and v != fill:
                arr[i] = round(v, 2)
        values[p] = arr
    return {
        "first": FIRST,
        "last": LAST,
        "timeStandard": j["header"].get("time_standard"),
        "sources": j["header"].get("sources"),
        "api": j["header"].get("api", {}).get("version"),
        "fetchedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "values": values,
    }


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for cid, name, lat, lon in CITIES:
        c = compact(fetch(lat, lon))
        path = OUT / f"{cid}.rain.json"
        path.write_text(json.dumps(c, separators=(",", ":")), encoding="utf-8")
        missing = {p: sum(v is None for v in c["values"][p]) for p in PARAMS}
        print(f"{name}: {path.name} {path.stat().st_size // 1024} KB, time standard {c['timeStandard']}, sources {c['sources']}, missing days {missing}")
        time.sleep(1)


if __name__ == "__main__":
    main()
