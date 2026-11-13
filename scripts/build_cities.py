"""Build web/public/cities.json from the GeoNames cities15000 dump.

Usage: python scripts/build_cities.py <dir containing cities15000.txt and countryInfo.txt>

Keeps cities with population > 100,000. Output is a compact JSON array of
[name, asciiName, countryName, lat, lon, population] (GeoNames, CC BY 4.0).
"""
import json, sys
from pathlib import Path

src = Path(sys.argv[1])
out = Path(__file__).resolve().parent.parent / "web" / "public" / "cities.json"

countries = {}
for line in (src / "countryInfo.txt").read_text(encoding="utf-8").splitlines():
    if line.startswith("#") or not line.strip():
        continue
    f = line.split("\t")
    countries[f[0]] = f[4]

rows = []
for line in (src / "cities15000.txt").read_text(encoding="utf-8").splitlines():
    f = line.split("\t")
    # geonameid, name, asciiname, alternatenames, lat, lon, fclass, fcode, country, cc2, admin1..4, population, ...
    pop = int(f[14] or 0)
    if pop <= 100_000:
        continue
    rows.append([f[1], f[2], countries.get(f[8], f[8]), round(float(f[4]), 4), round(float(f[5]), 4), pop])

rows.sort(key=lambda r: -r[5])
out.write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"{len(rows)} cities -> {out} ({out.stat().st_size/1024:.0f} KB)")
