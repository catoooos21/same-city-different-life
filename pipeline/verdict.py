"""Plain-language verdicts (English + Arabic) generated from trend statistics.

The wording is templated; every number is taken from the computed trend dict.
"""
from __future__ import annotations


def _p(p: float | None) -> str:
    if p is None:
        return "p undefined"
    return "p < 0.001" if p < 0.001 else f"p = {p:.3f}"


def _p_ar(p: float | None) -> str:
    if p is None:
        return "p غير محدد"
    return "p < 0.001" if p < 0.001 else f"p = {p:.3f}"


def _fmt(v: float | None, unit: str, digits: int = 2, sign: bool = True) -> str:
    if v is None:
        return "n/a"
    s = f"{v:+.{digits}f}" if sign else f"{v:.{digits}f}"
    return f"{s} {unit}".strip()


def build_verdict(var: dict, region_name: str, region_name_ar: str, label: str, label_ar: str,
                  unit: str, years: tuple[int, int], pct_note: bool = True,
                  extra: str = "", extra_ar: str = "", baseline: tuple[int, int] | None = None) -> dict:
    t = var.get("trend")
    y0, y1 = years
    if t is None:
        return {
            "headline": "No significant trend", "headline_ar": "لا اتجاه معنوي", "stamp": "INCONCLUSIVE",
            "what": f"{label} in {region_name}", "where": region_name,
            "how_much": "Not enough valid years to test.",
            "significant": "Test not run.",
            "text": f"We could not test {label.lower()} in {region_name}: too few valid years.",
            "text_ar": f"لم نستطع اختبار {label_ar} في {region_name_ar}: سنوات صالحة غير كافية.",
        }
    sig = t["significant"]
    slope = t["slope_per_decade"]
    lo, hi = t["ci95_per_decade"]
    total = t["total_change"]
    pct = t.get("pct_change_vs_baseline")
    n = t["n"]
    p = t["p_value"]
    direction = "increase" if slope > 0 else "decrease"
    direction_ar = "ارتفاع" if slope > 0 else "انخفاض"
    digits = 2 if abs(slope) >= 0.05 else 3

    how_much = (f"{_fmt(slope, unit, digits)} per decade (95% CI {_fmt(lo, '', digits)} to "
                f"{_fmt(hi, unit, digits)}); {_fmt(total, unit, digits)} in total over {y0}-{y1}")
    if pct_note and pct is not None:
        b = f"{baseline[0]}-{baseline[1]}" if baseline else f"{y0}s"
        how_much += f", about {pct:+.1f}% versus the {b} baseline"
    how_much += "."
    how_much_ar = (f"{_fmt(slope, unit, digits)} لكل عقد (فاصل ثقة 95%: {_fmt(lo, '', digits)} إلى "
                   f"{_fmt(hi, unit, digits)})؛ إجمالي {_fmt(total, unit, digits)} خلال {y0}-{y1}.")

    if sig:
        headline = f"Significant {direction}"
        stamp = "CASE CLOSED"
        significant = (f"Yes. Mann-Kendall test with autocorrelation correction, {_p(p)}, "
                       f"{n} annual values. The 95% confidence interval excludes zero.")
        text = (f"{label} in {region_name} shows a statistically significant {direction} of "
                f"{_fmt(slope, unit, digits)} per decade since {y0} ({_p(p)}). "
                f"That adds up to {_fmt(total, unit, digits)} over {y1 - y0 + 1} years.")
        text_ar = (f"يُظهر {label_ar} في {region_name_ar} {direction_ar}ًا ذا دلالة إحصائية بمقدار "
                   f"{_fmt(slope, unit, digits)} لكل عقد منذ {y0} ({_p_ar(p)}). "
                   f"أي ما يعادل {_fmt(total, unit, digits)} خلال {y1 - y0 + 1} سنة.")
    else:
        headline = "No significant trend"
        stamp = "INCONCLUSIVE"
        significant = (f"No. Mann-Kendall test with autocorrelation correction, {_p(p)}, "
                       f"{n} annual values. The 95% confidence interval includes zero, so we can't tell.")
        text = (f"{label} in {region_name} drifted by {_fmt(slope, unit, digits)} per decade since {y0}, "
                f"but the change is not statistically significant ({_p(p)}). With {n} years of data we "
                f"can't rule out that this is natural year-to-year variability.")
        text_ar = (f"تغيّر {label_ar} في {region_name_ar} بمقدار {_fmt(slope, unit, digits)} لكل عقد منذ {y0}، "
                   f"لكن التغيّر ليس ذا دلالة إحصائية ({_p_ar(p)}). مع {n} سنة من البيانات لا يمكننا "
                   f"استبعاد أن هذا تقلّب طبيعي من سنة إلى أخرى.")
    if extra:
        text += " " + extra
    if extra_ar:
        text_ar += " " + extra_ar
    headline_ar = {"increase": "ارتفاع معنوي", "decrease": "انخفاض معنوي"}[direction] if sig else "لا اتجاه معنوي"
    return {
        "headline": headline, "headline_ar": headline_ar, "stamp": stamp,
        "what": f"{label} ({unit})" if unit else label,
        "where": region_name,
        "how_much": how_much,
        "significant": significant,
        "what_ar": label_ar, "where_ar": region_name_ar, "how_much_ar": how_much_ar,
        "text": text, "text_ar": text_ar,
    }
