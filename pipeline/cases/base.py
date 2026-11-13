"""Shared machinery: load a variable (Earthdata first, labelled fallback second, else
'unavailable'), analyse it per region, write the case JSON files."""
from __future__ import annotations

import json
import logging
import traceback
from dataclasses import dataclass, field
from typing import Callable

import numpy as np
import xarray as xr

from pipeline.analysis import analyze_series, grid_trend_block, regional_series
from pipeline.config import DATA_PROCESSED, Dataset
from pipeline.regions import Region, overlap_weights, region_geometry

log = logging.getLogger(__name__)

# status of every source, filled while building, written to index.json
SOURCES: dict[str, dict] = {}


@dataclass
class VarSpec:
    id: str
    label: str
    label_ar: str
    unit: str
    dataset: Dataset
    variable: str
    loader: Callable[[], xr.DataArray]                 # Earthdata path
    fallback: Callable[[], xr.DataArray] | None = None  # login-free, labelled
    fallback_note: str = ""
    log10: bool = False
    primary: bool = False
    pct_note: bool = True
    description: str = ""


def _record(ds: Dataset, variable: str, status: str, note: str):
    key = f"{ds.key}:{variable}"
    SOURCES[key] = {"id": ds.key, "short_name": ds.short_name, "version": ds.version,
                    "variable": variable, "daac": ds.daac, "doi": ds.doi,
                    "role": ds.role, "case": ds.case, "status": status, "note": note}


def load_variable(spec: VarSpec) -> tuple[xr.DataArray | None, dict | None]:
    """Returns (monthly grid, source dict) or (None, None) if nothing could be loaded."""
    src = {"short_name": spec.dataset.short_name, "version": spec.dataset.version,
           "variable": spec.variable, "daac": spec.dataset.daac, "doi": spec.dataset.doi}
    try:
        da = spec.loader()
        _record(spec.dataset, spec.variable, "ok", "Earthdata (earthaccess)")
        return da, {**src, "access": "earthdata"}
    except Exception as e:  # noqa: BLE001
        reason = f"{type(e).__name__}: {str(e)[:120]}"
        log.warning("%s %s via Earthdata failed: %s", spec.dataset.short_name, spec.variable, reason)
    if spec.fallback is not None:
        try:
            da = spec.fallback()
            _record(spec.dataset, spec.variable, "fallback",
                    f"Earthdata unavailable ({reason}); using {spec.fallback_note}")
            return da, {**src, "access": "power_fallback", "fallback_note": spec.fallback_note,
                        "fallback_source": da.attrs.get("source", "NASA POWER")}
        except Exception as e:  # noqa: BLE001
            log.error("fallback failed too: %s", e)
            traceback.print_exc()
            reason += f"; fallback failed: {type(e).__name__}"
    _record(spec.dataset, spec.variable, "unavailable", reason)
    return None, None


def _dump(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


def build_case(case_id: str, title: str, title_ar: str, question: str, question_ar: str,
               specs: list[VarSpec], regions: list[Region], years: tuple[int, int],
               baseline: tuple[int, int], limitations: list[str], limitations_ar: list[str],
               verdict_fn: Callable, extra_fn: Callable | None = None, map_region: str = "all_kuwait") -> dict:
    """Build every region file + map files for one case.  Returns the index entry."""
    out_dir = DATA_PROCESSED / "cases" / case_id
    loaded: list[tuple[VarSpec, xr.DataArray, dict]] = []
    for spec in specs:
        da, src = load_variable(spec)
        if da is not None:
            loaded.append((spec, da, src))

    status = "ok" if any(s.primary for s, _, _ in loaded) else "data_unavailable"
    if status == "data_unavailable":
        _dump(out_dir / "_status.json", {"status": status, "reason": "primary variable unavailable"})
        return {"id": case_id, "title": title, "title_ar": title_ar, "question": question,
                "question_ar": question_ar, "status": status, "regions": []}

    # maps (per variable, whole AOI masked to the land/sea region)
    maps = []
    for spec, da, src in loaded:
        w = overlap_weights(da["lat"].to_numpy(), da["lon"].to_numpy(), region_geometry(map_region), cos_lat=False)
        mask = xr.DataArray(w.to_numpy() > 0.05, coords=w.coords, dims=w.dims)
        try:
            block = grid_trend_block(da, years, mask=mask, log10=spec.log10)
            block.update({"case": case_id, "variable": spec.id, "label": spec.label,
                          "unit_per_decade": f"{spec.unit}/decade" if spec.unit else "per decade",
                          "source": src})
            _dump(DATA_PROCESSED / "maps" / f"{case_id}_{spec.id}.json", block)
            maps.append(spec.id)
            log.info("map %s/%s: %d cells, %d FDR-significant (%d up, %d down)", case_id, spec.id,
                     block["n_cells"], block["n_significant"], block["n_sig_increase"], block["n_sig_decrease"])
        except Exception as e:  # noqa: BLE001
            log.error("map for %s failed: %s", spec.id, e)
            traceback.print_exc()

    # regions
    region_ids = []
    for reg in regions:
        geom = region_geometry(reg.id)
        variables = []
        for spec, da, src in loaded:
            w = overlap_weights(da["lat"].to_numpy(), da["lon"].to_numpy(), geom)
            if float(w.sum()) == 0:
                continue
            s = regional_series(da, w)
            block = analyze_series(s, years, baseline, log10=spec.log10)
            block.update({"id": spec.id, "label": spec.label, "label_ar": spec.label_ar,
                          "unit": ("log10 " + spec.unit) if spec.log10 else spec.unit,
                          "description": spec.description, "primary": spec.primary, "source": src,
                          "n_cells": int((w > 0).sum()), "has_map": spec.id in maps})
            variables.append(block)
        primary = next((v for v in variables if v["primary"]), None)
        if primary is None:
            continue
        doc = {
            "case": case_id, "title": title, "title_ar": title_ar,
            "question": question, "question_ar": question_ar,
            "region": {"id": reg.id, "name": reg.name, "name_ar": reg.name_ar, "kind": reg.kind},
            "period": {"start": years[0], "end": years[1], "baseline": list(baseline)},
            "variables": variables,
            "limitations": limitations, "limitations_ar": limitations_ar,
        }
        if extra_fn is not None:
            doc.update(extra_fn(doc, primary) or {})
        doc["verdict"] = verdict_fn(doc, primary, reg)
        doc["evidence"] = evidence_lines(doc)
        _dump(out_dir / f"{reg.id}.json", doc)
        region_ids.append(reg.id)
        t = primary["trend"]
        log.info("%-5s %-12s %s: %+.3f %s/decade  p=%.4f  n=%d  -> %s", case_id, reg.id, primary["id"],
                 t["slope_per_decade"], primary["unit"], t["p_value"], t["n"], t["verdict"])

    return {"id": case_id, "title": title, "title_ar": title_ar, "question": question,
            "question_ar": question_ar, "status": status, "regions": region_ids,
            "variables": [{"id": s.id, "label": s.label, "label_ar": s.label_ar, "primary": s.primary}
                          for s, _, _ in loaded], "maps": maps}


def evidence_lines(doc: dict) -> list[str]:
    lines = []
    for v in doc["variables"]:
        src = v["source"]
        if src["access"] == "earthdata":
            lines.append(f"{v['label']}: {src['short_name']} v{src['version']} ({src['variable']}), {src['daac']}, DOI {src['doi']}.")
        else:
            lines.append(f"{v['label']}: {src.get('fallback_source', 'NASA POWER')} (FALLBACK, standing in for "
                         f"{src['short_name']} {src['variable']} while Earthdata access is unavailable).")
    p = doc["period"]
    lines.append(f"Area-weighted regional mean, monthly anomalies vs {p['baseline'][0]}-{p['baseline'][1]}, "
                 f"annual means {p['start']}-{p['end']}.")
    lines.append("Trend: Mann-Kendall test with Hamed-Rao autocorrelation correction; magnitude: Sen's slope "
                 "with 95% confidence interval (Theil-Sen). Seasonal Kendall on monthly anomalies as a check.")
    lines.append("Map: per-cell Mann-Kendall + Sen's slope, Benjamini-Hochberg FDR at q = 0.05; "
                 "only FDR-significant cells are drawn solid.")
    return lines
