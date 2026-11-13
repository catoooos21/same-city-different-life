"""The Dust Case: Is Kuwait getting dustier?"""
from __future__ import annotations

from pipeline import nasa, power
from pipeline.cases.base import VarSpec, build_case
from pipeline.config import DATASETS, LAND_BASELINE, LAND_YEARS, PREVIEW_YEAR
from pipeline.regions import LAND_REGIONS
from pipeline.verdict import build_verdict

DS = {d.key: d for d in DATASETS}
Y0, Y1 = LAND_YEARS


def _aer(var, scale=1.0):
    return lambda: nasa.merra2_monthly(DS["m2tmnxaer"], Y0, PREVIEW_YEAR)[var] * scale


def _mod08():
    return nasa.modis_cmg_monthly(DS["mod08_m3"], Y0, PREVIEW_YEAR, res=1.0)["Deep_Blue_Aerosol_Optical_Depth_550_Land_Mean_Mean"]


SPECS = [
    VarSpec("duexttau", "Dust optical depth (550 nm)", "العمق البصري للغبار", "",
            DS["m2tmnxaer"], "DUEXTTAU", _aer("DUEXTTAU"),
            fallback=lambda: power.monthly_grid("AOD_55", Y0, PREVIEW_YEAR),
            fallback_note="NASA POWER AOD_55: TOTAL aerosol optical depth from CERES SYN1deg, not dust-only",
            primary=True,
            description="How much sunlight the dust column blocks. 0.1 is clear, 0.5 is a hazy day, >1 is a dust storm month."),
    VarSpec("dusmass", "Dust surface concentration", "تركيز الغبار السطحي", "µg/m³",
            DS["m2tmnxaer"], "DUSMASS", _aer("DUSMASS", 1e9),
            description="Mass of dust in the air you breathe near the ground, from MERRA-2."),
    VarSpec("totexttau", "Total aerosol optical depth (550 nm)", "العمق البصري الكلي للهباء", "",
            DS["m2tmnxaer"], "TOTEXTTAU", _aer("TOTEXTTAU"),
            description="All aerosols together (dust, sea salt, pollution, smoke)."),
    VarSpec("mod08_aod", "MODIS Deep Blue AOD over land (satellite cross-check)", "العمق البصري من MODIS (تحقّق)", "",
            DS["mod08_m3"], "Deep_Blue_Aerosol_Optical_Depth_550_Land_Mean_Mean", _mod08,
            description="Independent satellite measurement of aerosol optical depth, 1 degree grid. If MERRA-2 and MODIS agree, we trust the trend more."),
]

LIMITATIONS = [
    "MERRA-2 dust is a model product (reanalysis). The aerosol observations it assimilates changed over "
    "time (e.g. the end of MISR/AVHRR inputs), which can create artificial jumps. We cross-check with "
    "MODIS Deep Blue aerosol optical depth, an independent satellite record.",
    "Optical depth measures the whole air column; surface concentration is what you breathe. They can "
    "trend differently.",
    "Dust in Kuwait is dominated by a few big storm months each spring and summer, so annual means are "
    "noisy and trends need many years to become significant.",
    "MODIS 1 degree cells are huge: the whole country is about two cells.",
]
LIMITATIONS_AR = [
    "غبار MERRA-2 ناتج نموذج إعادة تحليل؛ تغيّر الأرصاد المُدمجة قد يُحدث قفزات مصطنعة، لذلك نتحقق من MODIS.",
    "العمق البصري يقيس عمود الهواء كله؛ التركيز السطحي هو ما تتنفسه.",
    "يسود الغبار في الكويت في بضعة أشهر عاصفة سنوياً، لذا المتوسطات السنوية متقلبة.",
    "خلايا MODIS بدرجة واحدة ضخمة: الكويت كلها نحو خليتين.",
]


def _verdict(doc, primary, reg):
    lbl = primary["label"]
    is_fb = primary["source"]["access"] != "earthdata"
    extra = ("Note: this figure is total aerosol optical depth from NASA POWER (CERES SYN1deg), used as a "
             "labelled fallback until MERRA-2 dust-only data are fetched.") if is_fb else ""
    return build_verdict(primary, reg.name, reg.name_ar, lbl, primary["label_ar"], primary["unit"],
                         LAND_YEARS, pct_note=True, extra=extra, baseline=LAND_BASELINE)


def build() -> dict:
    return build_case(
        "dust", "The Dust Case", "قضية الغبار",
        "Is Kuwait getting dustier?", "هل تزداد الكويت غباراً؟",
        SPECS, LAND_REGIONS, LAND_YEARS, LAND_BASELINE, LIMITATIONS, LIMITATIONS_AR,
        verdict_fn=_verdict,
    )
