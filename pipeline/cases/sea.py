"""The Sea Case: Is the water around Kuwait getting warmer and greener?"""
from __future__ import annotations

from pipeline import nasa
from pipeline.cases.base import VarSpec, build_case
from pipeline.config import DATASETS, PREVIEW_YEAR, SEA_BASELINE, SEA_YEARS
from pipeline.regions import SEA_REGIONS
from pipeline.verdict import build_verdict

DS = {d.key: d for d in DATASETS}
Y0, Y1 = SEA_YEARS

SPECS = [
    VarSpec("sst", "Sea surface temperature", "حرارة سطح البحر", "°C",
            DS["modisa_sst"], "sst", lambda: nasa.obdaac_monthly(DS["modisa_sst"], Y0, PREVIEW_YEAR)["sst"],
            primary=True, pct_note=False,
            description="Skin temperature of the sea from the Aqua satellite, 4 km cells, monthly."),
    VarSpec("chl", "Chlorophyll-a (log10)", "الكلوروفيل أ (لوغاريتم)", "mg/m³",
            DS["modisa_chl"], "chlor_a", lambda: nasa.obdaac_monthly(DS["modisa_chl"], Y0, PREVIEW_YEAR)["chlor_a"],
            log10=True,
            description="A proxy for algae. Analysed as log10 because chlorophyll is log-normally distributed; "
                        "a change of +0.1 in log10 is about +26%."),
]

LIMITATIONS = [
    "Gulf water is shallow and sediment-rich, so the standard MODIS chlorophyll algorithm is biased high. "
    "We trust trends in anomalies, not the absolute values.",
    "Sea surface temperature from a satellite is the top millimetre of water, and only on cloud-free days.",
    "Kuwait Bay is small (a few hundred 4 km cells) and coastal pixels can be contaminated by land.",
    "23 years (2003-2025) is a short record; confidence intervals are reported.",
]
LIMITATIONS_AR = [
    "مياه الخليج ضحلة وغنية بالرواسب، لذا خوارزمية الكلوروفيل مُحيّزة نحو الأعلى؛ نثق بالاتجاهات لا بالقيم المطلقة.",
    "حرارة سطح البحر من القمر الصناعي تمثل المليمتر الأعلى من الماء وفي الأيام الصافية فقط.",
    "جون الكويت صغير وقد تتأثر الخلايا الساحلية باليابسة.",
    "23 سنة فترة قصيرة؛ نعرض فواصل الثقة.",
]


def _verdict(doc, primary, reg):
    chl = next((v for v in doc["variables"] if v["id"] == "chl"), None)
    extra = extra_ar = ""
    if chl and chl.get("trend"):
        t = chl["trend"]
        pct = (10 ** t["slope_per_decade"] - 1) * 100
        word = "greener" if t["slope_per_decade"] > 0 else "less green"
        sig = "significant" if t["significant"] else "not significant"
        extra = (f"Chlorophyll-a (algae proxy) changed by {t['slope_per_decade']:+.3f} log10 units per decade, "
                 f"about {pct:+.0f}% per decade ({sig}, p = {t['p_value']:.3f}): the water is getting {word}"
                 f"{'' if t['significant'] else ', but we cannot be sure'}.")
    return build_verdict(primary, reg.name, reg.name_ar, "Sea surface temperature", "حرارة سطح البحر",
                         "°C", SEA_YEARS, pct_note=False, extra=extra, extra_ar=extra_ar)


def build() -> dict:
    return build_case(
        "sea", "The Sea Case", "قضية البحر",
        "Is the water around Kuwait getting warmer and greener?",
        "هل تصبح مياه الكويت أدفأ وأكثر اخضراراً؟",
        SPECS, SEA_REGIONS, SEA_YEARS, SEA_BASELINE, LIMITATIONS, LIMITATIONS_AR,
        verdict_fn=_verdict, map_region="all_sea",
    )
