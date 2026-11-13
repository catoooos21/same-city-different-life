"""The Heat Case: Is Kuwait heating up, and faster than the world?"""
from __future__ import annotations

from pipeline import gistemp, nasa, power
from pipeline.cases.base import VarSpec, build_case
from pipeline.config import DATASETS, LAND_BASELINE, LAND_YEARS, PREVIEW_YEAR
from pipeline.regions import LAND_REGIONS
from pipeline.verdict import build_verdict

DS = {d.key: d for d in DATASETS}
Y0, Y1 = LAND_YEARS


def _merra(var):
    return lambda: nasa.merra2_monthly(DS["m2tmnxslv"], Y0, PREVIEW_YEAR)[var] - 273.15


def _lst(var):
    return lambda: nasa.modis_cmg_monthly(DS["mod11c3"], Y0, PREVIEW_YEAR, res=0.05)[var]


SPECS = [
    VarSpec("t2m", "Air temperature (2 m, monthly mean)", "درجة حرارة الهواء (متر 2)", "°C",
            DS["m2tmnxslv"], "T2M", _merra("T2M"),
            fallback=lambda: power.monthly_grid("T2M", Y0, PREVIEW_YEAR),
            fallback_note="NASA POWER T2M (MERRA-2 values served by POWER)", primary=True, pct_note=False,
            description="What a thermometer in the shade would read, averaged over the month. From the MERRA-2 reanalysis."),
    VarSpec("t2m_max", "Air temperature (2 m, monthly mean of daily max)", "الحرارة العظمى (متر 2)", "°C",
            DS["m2tmnxslv"], "T2MMAX", _merra("T2MMAX"),
            fallback=lambda: power.monthly_grid("T2M_MAX", Y0, PREVIEW_YEAR),
            fallback_note="NASA POWER T2M_MAX (MERRA-2 values served by POWER)", pct_note=False,
            description="Afternoon heat: the monthly mean of each day's maximum."),
    VarSpec("lst_day", "Land surface temperature (daytime)", "حرارة سطح الأرض (نهاراً)", "°C",
            DS["mod11c3"], "LST_Day_CMG", _lst("LST_Day_CMG"), pct_note=False,
            description="How hot the ground itself is at ~10:30 local time, seen from the Terra satellite. Not air temperature."),
    VarSpec("lst_night", "Land surface temperature (night-time)", "حرارة سطح الأرض (ليلاً)", "°C",
            DS["mod11c3"], "LST_Night_CMG", _lst("LST_Night_CMG"), pct_note=False,
            description="Ground temperature at ~22:30 local time from Terra. Night warming is a fingerprint of urban heat."),
]

LIMITATIONS = [
    "MERRA-2 is a model (reanalysis), not a thermometer network. Changes in the satellite observations it "
    "assimilates can create artificial jumps. We therefore also show MODIS land surface temperature, an "
    "independent satellite measurement.",
    "Land surface temperature is the temperature of the ground, not the air you feel; it responds more "
    "strongly to sunshine, soil moisture and urban surfaces.",
    "The MERRA-2 grid is coarse (about 50 x 60 km); Kuwait City metro covers only a fraction of one cell, so "
    "governorate-level results from MERRA-2 are nearly identical to the national one.",
    "25 years is short for climate trends. We report 95% confidence intervals and an autocorrelation-corrected "
    "test, but a single very hot or cool year still moves the slope.",
    "The global comparison uses GISTEMP, which blends land and sea surface temperature; Kuwait's figure is a "
    "land-only 2 m air temperature. Land warms faster than oceans everywhere, so part of the ratio is expected.",
]
LIMITATIONS_AR = [
    "MERRA-2 نموذج إعادة تحليل وليس شبكة مقاييس حرارة؛ قد تُحدث تغييرات الأرصاد المُدمجة فيه قفزات مصطنعة، لذلك نعرض أيضاً حرارة سطح الأرض من MODIS كقياس مستقل.",
    "حرارة سطح الأرض هي حرارة التربة لا الهواء الذي تشعر به.",
    "شبكة MERRA-2 خشنة (نحو 50×60 كم)، لذا نتائج المحافظات تقارب النتيجة الوطنية.",
    "25 سنة فترة قصيرة لاتجاهات المناخ؛ نعرض فواصل الثقة 95%.",
    "المقارنة العالمية تستخدم GISTEMP الذي يمزج اليابسة والمحيطات؛ اليابسة تسخن أسرع من المحيطات في كل مكان.",
]


def _extra(doc, primary):
    comp = gistemp.comparison(primary["annual_anomaly"], LAND_YEARS, LAND_BASELINE)
    return {"comparison": {"global": comp}}


def _verdict(doc, primary, reg):
    comp = doc["comparison"]["global"]
    extra = extra_ar = ""
    if comp.get("ratio_kuwait_to_global") is not None and comp["trend"]:
        r = comp["ratio_kuwait_to_global"]
        g = comp["trend"]["slope_per_decade"]
        extra = (f"The world warmed {g:+.2f} °C per decade over the same years (GISTEMP v4), so "
                 f"{reg.name} warmed about {r:.1f} times as fast as the global average.")
        extra_ar = (f"سخن العالم بمقدار {g:+.2f} °م لكل عقد في نفس الفترة (GISTEMP v4)، أي أن "
                    f"{reg.name_ar} سخنت نحو {r:.1f} أضعاف المعدل العالمي.")
    return build_verdict(primary, reg.name, reg.name_ar, "Air temperature", "درجة حرارة الهواء",
                         "°C", LAND_YEARS, pct_note=False, extra=extra, extra_ar=extra_ar)


def build() -> dict:
    return build_case(
        "heat", "The Heat Case", "قضية الحرارة",
        "Is Kuwait heating up, and faster than the world?",
        "هل تسخن الكويت، وبوتيرة أسرع من العالم؟",
        SPECS, LAND_REGIONS, LAND_YEARS, LAND_BASELINE, LIMITATIONS, LIMITATIONS_AR,
        verdict_fn=_verdict, extra_fn=_extra,
    )
