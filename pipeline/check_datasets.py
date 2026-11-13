"""Step 1: verify every dataset against NASA CMR and print an availability table.

Usage:  python -m pipeline.check_datasets [--out docs/datasets_cmr_check.md]

Collection search on CMR is public, so no Earthdata Login is required here.
"""
from __future__ import annotations

import argparse
import datetime as dt
import sys

import earthaccess
import requests
from tabulate import tabulate

from pipeline.config import DATASETS, EXTERNAL_SOURCES, Dataset


def _collection_rows(ds: Dataset):
    cols = earthaccess.search_datasets(short_name=ds.short_name)
    out = []
    for c in cols:
        umm = c["umm"]
        ext = (umm.get("TemporalExtents") or [{}])[0]
        rng = (ext.get("RangeDateTimes") or [{}])[0]
        end = (rng.get("EndingDateTime") or "")[:10]
        if not end and ext.get("EndsAtPresentFlag"):
            end = "ongoing"
        out.append({
            "version": umm.get("Version"),
            "concept_id": c["meta"]["concept-id"],
            "provider": c["meta"].get("provider-id"),
            "start": (rng.get("BeginningDateTime") or "")[:10],
            "end": end,
        })
    return out


def _granules(ds: Dataset, version: str):
    y0, y1 = ds.years
    q = (earthaccess.DataGranules()
         .short_name(ds.short_name)
         .version(version)
         .temporal(f"{y0}-01-01", f"{y1}-12-31")
         .bounding_box(*ds.bbox))
    if ds.granule_pattern:
        q = q.granule_name(ds.granule_pattern)
    n = q.hits()
    first = last = ""
    if 0 < n <= 2000:
        gr = q.get(n)
        starts = sorted(g["umm"]["TemporalExtent"]["RangeDateTime"]["BeginningDateTime"] for g in gr)
        first, last = starts[0][:10], starts[-1][:10]
    return n, first, last


def check_cmr():
    rows = []
    for ds in DATASETS:
        cols = _collection_rows(ds)
        if not cols:
            rows.append([ds.short_name, ds.version or "?", "NOT FOUND", "", "", "", "", ds.case])
            continue
        versions = [c["version"] for c in cols]
        chosen = next((c for c in cols if ds.version and c["version"] == ds.version), None)
        status = "ok"
        if chosen is None:
            chosen = sorted(cols, key=lambda c: str(c["version"]))[-1]
            status = f"VERSION CHANGED -> {chosen['version']}" if ds.version else f"using {chosen['version']}"
        n, first, last = _granules(ds, chosen["version"])
        y0, y1 = ds.years
        expected = 12 * (y1 - y0 + 1) if ds.key != "m2c0nxasm" else 1
        rows.append([
            ds.short_name, chosen["version"], status, chosen["provider"],
            f"{chosen['start']} to {chosen['end']}",
            f"{n} / {expected}", f"{first} .. {last}", ds.case,
        ])
        if len(versions) > 1:
            print(f"  note: {ds.short_name} has versions {versions}", file=sys.stderr)
    return rows


def check_external():
    rows = []
    for name, url in EXTERNAL_SOURCES.items():
        try:
            r = requests.get(url, timeout=30, stream=True,
                             headers={"User-Agent": "ghubar-holmes-check/0.1"})
            size = r.headers.get("Content-Length", "?")
            rows.append([name, r.status_code, size, url.split("?")[0]])
            r.close()
        except Exception as e:  # noqa: BLE001
            rows.append([name, f"ERROR {type(e).__name__}", "", url.split("?")[0]])
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=None, help="write a Markdown report here")
    args = ap.parse_args()

    print("Querying NASA CMR (no login needed)...", file=sys.stderr)
    cmr = check_cmr()
    hdr = ["short_name", "version", "status", "provider", "collection range",
           "granules in AOI+years / expected", "first .. last granule", "case"]
    ext = check_external()
    ehdr = ["source", "http", "bytes", "url"]

    md = (f"# Dataset availability check\n\nRun: {dt.datetime.now(dt.timezone.utc):%Y-%m-%d %H:%M} UTC\n\n"
          "## NASA CMR collections\n\n" + tabulate(cmr, hdr, tablefmt="github") +
          "\n\n## Non-CMR sources\n\n" + tabulate(ext, ehdr, tablefmt="github") + "\n")
    print(md)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(md)
        print(f"\nwritten {args.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
