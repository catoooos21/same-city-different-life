"""The Connected Case: Do hotter years bring more dust?

Reads the already-built heat and dust region files and correlates their annual anomalies.
Correlation is not causation, and the output says so.
"""
from __future__ import annotations

import json
import logging

import numpy as np

from pipeline import stats as S
from pipeline.config import DATA_PROCESSED, LAND_YEARS
from pipeline.regions import LAND_REGIONS

log = logging.getLogger(__name__)

LIMITATIONS = [
    "Correlation is not causation. Hot years and dusty years can share a cause (for example drought, "
    "low soil moisture or a persistent wind pattern) without one causing the other.",
    "Both series are annual means over the same region, so they are not independent samples of weather.",
    "With about 25 pairs of years, only fairly strong correlations can be detected.",
    "If either input is a fallback source (NASA POWER), the same caveats as in that case apply.",
]
LIMITATIONS_AR = [
    "الارتباط لا يعني السببية؛ قد تشترك السنوات الحارة والمغبرة في سبب واحد (كالجفاف أو نمط رياح مستمر).",
    "السلسلتان متوسطان سنويان للمنطقة نفسها، فليستا عينتين مستقلتين.",
    "مع نحو 25 زوجاً من السنوات لا يمكن رصد إلا الارتباطات القوية نسبياً.",
    "إذا كان أي مُدخل مصدراً بديلاً (NASA POWER) فتنطبق تحفظات تلك القضية.",
]


def _primary(doc):
    return next(v for v in doc["variables"] if v["primary"])


def _dump(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


def build() -> dict:
    out_dir = DATA_PROCESSED / "cases" / "connected"
    region_ids = []
    for reg in LAND_REGIONS:
        hp = DATA_PROCESSED / "cases" / "heat" / f"{reg.id}.json"
        dp = DATA_PROCESSED / "cases" / "dust" / f"{reg.id}.json"
        if not (hp.exists() and dp.exists()):
            continue
        heat = json.loads(hp.read_text(encoding="utf-8"))
        dust = json.loads(dp.read_text(encoding="utf-8"))
        h, d = _primary(heat), _primary(dust)
        hy = dict(zip(h["annual_anomaly"]["years"], h["annual_anomaly"]["values"]))
        dy = dict(zip(d["annual_anomaly"]["years"], d["annual_anomaly"]["values"]))
        years = sorted(set(hy) & set(dy))
        x = np.array([np.nan if hy[y] is None else hy[y] for y in years], float)
        yv = np.array([np.nan if dy[y] is None else dy[y] for y in years], float)
        r = S.pearson_with_ci(x, yv)
        # detrended version: does the year-to-year wiggle co-vary, not just the two trends?
        xr_, yr_ = x - np.nanmean(x), yv - np.nanmean(yv)
        ok = np.isfinite(x) & np.isfinite(yv)
        t = np.array(years, float)
        px = np.polyfit(t[ok], x[ok], 1)
        py = np.polyfit(t[ok], yv[ok], 1)
        rd = S.pearson_with_ci(x - np.polyval(px, t), yv - np.polyval(py, t))

        if r is None:
            headline, stamp, sig = "No significant trend", "INCONCLUSIVE", False
            text = "Not enough overlapping years to test."
            text_ar = "لا توجد سنوات متداخلة كافية للاختبار."
        else:
            sig = r["pearson_p"] < 0.05
            strength = ("strong" if abs(r["pearson_r"]) >= 0.6 else "moderate" if abs(r["pearson_r"]) >= 0.3 else "weak")
            sign = "positive" if r["pearson_r"] > 0 else "negative"
            headline = (f"Significant {sign} correlation" if sig else "No significant correlation")
            stamp = "CASE CLOSED" if sig else "INCONCLUSIVE"
            det = ""
            if rd is not None:
                det = (f" After removing both long-term trends, the year-to-year correlation is r = {rd['pearson_r']:+.2f} "
                       f"(p = {rd['pearson_p']:.3f}){', so hot years really do tend to be dusty years' if rd['pearson_p'] < 0.05 else ', so the link is mostly the shared long-term trends, not the individual years'}.")
            text = (f"Across {r['n']} years in {reg.name}, annual air-temperature anomalies and {d['label'].lower()} anomalies "
                    f"show a {strength} {sign} correlation: Pearson r = {r['pearson_r']:+.2f} "
                    f"(95% CI {r['r_ci95'][0]:+.2f} to {r['r_ci95'][1]:+.2f}, p = {r['pearson_p']:.3f}); "
                    f"Spearman rho = {r['spearman_rho']:+.2f}.{det} Correlation is not causation.")
            text_ar = (f"خلال {r['n']} سنة في {reg.name_ar}، يُظهر انحراف حرارة الهواء السنوي وانحراف الغبار ارتباطاً "
                       f"{'موجباً' if r['pearson_r'] > 0 else 'سالباً'}: معامل بيرسون r = {r['pearson_r']:+.2f} "
                       f"(p = {r['pearson_p']:.3f}). الارتباط لا يعني السببية.")
        doc = {
            "case": "connected", "title": "The Connected Case", "title_ar": "القضية المترابطة",
            "question": "Do hotter years bring more dust?", "question_ar": "هل تجلب السنوات الأكثر حرارة غباراً أكثر؟",
            "region": {"id": reg.id, "name": reg.name, "name_ar": reg.name_ar, "kind": "land"},
            "period": {"start": LAND_YEARS[0], "end": LAND_YEARS[1], "baseline": heat["period"]["baseline"]},
            "x": {"id": h["id"], "label": h["label"], "label_ar": h.get("label_ar"), "unit": h["unit"], "source": h["source"]},
            "y": {"id": d["id"], "label": d["label"], "label_ar": d.get("label_ar"), "unit": d["unit"], "source": d["source"]},
            "pairs": {"years": years, "x": [None if not np.isfinite(a) else round(float(a), 4) for a in x],
                      "y": [None if not np.isfinite(b) else round(float(b), 4) for b in yv]},
            "correlation": r, "correlation_detrended": rd,
            "variables": [],
            "verdict": {"headline": headline, "stamp": stamp,
                        "what": f"Link between {h['label']} and {d['label']} (annual anomalies)",
                        "where": reg.name,
                        "how_much": "" if r is None else f"Pearson r = {r['pearson_r']:+.2f} (95% CI {r['r_ci95'][0]:+.2f} to {r['r_ci95'][1]:+.2f})",
                        "significant": "" if r is None else (f"{'Yes' if sig else 'No'}: p = {r['pearson_p']:.3f}, {r['n']} years."),
                        "text": text, "text_ar": text_ar},
            "evidence": [
                f"X: {h['label']} annual anomaly from the Heat case ({h['source']['short_name']} {h['source']['variable']}, access: {h['source']['access']}).",
                f"Y: {d['label']} annual anomaly from the Dust case ({d['source']['short_name']} {d['source']['variable']}, access: {d['source']['access']}).",
                "Pearson correlation with Fisher-z 95% CI, Spearman rank correlation, and the same after removing each series' linear trend.",
            ],
            "limitations": LIMITATIONS, "limitations_ar": LIMITATIONS_AR,
        }
        _dump(out_dir / f"{reg.id}.json", doc)
        region_ids.append(reg.id)
        log.info("connected %-12s r=%+.2f p=%.3f  detrended r=%+.2f p=%.3f", reg.id,
                 r["pearson_r"] if r else float("nan"), r["pearson_p"] if r else float("nan"),
                 rd["pearson_r"] if rd else float("nan"), rd["pearson_p"] if rd else float("nan"))
    return {"id": "connected", "title": "The Connected Case", "title_ar": "القضية المترابطة",
            "question": "Do hotter years bring more dust?", "question_ar": "هل تجلب السنوات الأكثر حرارة غباراً أكثر؟",
            "status": "ok" if region_ids else "data_unavailable", "regions": region_ids, "variables": [], "maps": []}
