"""Rebuild everything:  python -m pipeline.build_all [--cases heat,dust,sea,connected]

Writes data/processed/{index.json, cases/, maps/, geo/}.  Raw NASA subsets are cached in
data/raw/ (gitignored) so a second run is fast.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import logging
import shutil
import sys

from pipeline import nasa
from pipeline.cases import base
from pipeline.config import DATA_GEO, DATA_PROCESSED
from pipeline.regions import LAND_REGIONS, SEA_REGIONS, export_geo

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s", stream=sys.stderr)
logging.getLogger("earthaccess").setLevel(logging.WARNING)
log = logging.getLogger("build")

ALL = ["heat", "dust", "sea", "connected"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cases", default=",".join(ALL))
    args = ap.parse_args()
    wanted = [c for c in args.cases.split(",") if c]

    DATA_PROCESSED.mkdir(parents=True, exist_ok=True)
    export_geo(DATA_GEO)
    geo_out = DATA_PROCESSED / "geo"
    geo_out.mkdir(exist_ok=True)
    for f in DATA_GEO.glob("*.geojson"):
        shutil.copy(f, geo_out / f.name)

    logged_in = nasa.login()
    log.info("Earthdata login: %s", "ok" if logged_in else "NOT available -> fallbacks where defined")

    index_path = DATA_PROCESSED / "index.json"
    index = json.loads(index_path.read_text(encoding="utf-8")) if index_path.exists() else {"cases": []}
    existing = {c["id"]: c for c in index.get("cases", [])}
    sources = {s["key"]: s for s in index.get("sources", []) if "key" in s}

    for case_id in wanted:
        try:
            if case_id == "heat":
                from pipeline.cases import heat as mod
            elif case_id == "dust":
                from pipeline.cases import dust as mod
            elif case_id == "sea":
                from pipeline.cases import sea as mod
            elif case_id == "connected":
                from pipeline.cases import connected as mod
            else:
                raise KeyError(case_id)
            entry = mod.build()
        except Exception as e:  # noqa: BLE001
            log.exception("case %s failed: %s", case_id, e)
            entry = {"id": case_id, "status": "data_unavailable", "regions": [], "error": f"{type(e).__name__}: {e}"}
        existing[case_id] = entry
        for k, v in base.SOURCES.items():
            sources[k] = {"key": k, **v}

    index = {
        "built_at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "earthdata_login": logged_in,
        "cases": [existing[c] for c in ALL if c in existing],
        "regions": {
            "land": [{"id": r.id, "name": r.name, "name_ar": r.name_ar} for r in LAND_REGIONS],
            "sea": [{"id": r.id, "name": r.name, "name_ar": r.name_ar} for r in SEA_REGIONS],
        },
        "sources": sorted(sources.values(), key=lambda s: (s.get("case", ""), s["key"])),
    }
    index_path.write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")
    log.info("wrote %s", index_path)
    for c in index["cases"]:
        log.info("  %-9s %s  regions=%s", c["id"], c["status"], c.get("regions"))
    for s in index["sources"]:
        log.info("  source %-28s %-11s %s", s["key"], s["status"], s["note"][:90])


if __name__ == "__main__":
    main()
