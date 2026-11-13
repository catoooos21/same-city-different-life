# Dataset availability check

Run: 2026-11-13 18:03 UTC

## NASA CMR collections

| short_name     | version   | status   | provider   | collection range         | granules in AOI+years / expected   | first .. last granule    | case   |
|----------------|-----------|----------|------------|--------------------------|------------------------------------|--------------------------|--------|
| MOD11C3        | 061       | ok       | LPCLOUD    | 2000-02-01 to ongoing    | 300 / 300                          | 2001-01-01 .. 2025-12-01 | heat   |
| M2TMNXSLV      | 5.12.4    | ok       | GES_DISC   | 1980-01-01 to ongoing    | 300 / 300                          | 2001-01-01 .. 2025-12-01 | heat   |
| M2TMNXAER      | 5.12.4    | ok       | GES_DISC   | 1980-01-01 to ongoing    | 300 / 300                          | 2001-01-01 .. 2025-12-01 | dust   |
| MOD08_M3       | 6.1       | ok       | LAADS      | 2000-02-01 to ongoing    | 301 / 300                          | 2000-12-01 .. 2025-12-01 | dust   |
| MODISA_L3m_SST | R2019.0   | ok       | OB_DAAC    | 2002-07-04 to ongoing    | 276 / 276                          | 2003-01-01 .. 2025-12-01 | sea    |
| MODISA_L3m_CHL | 2022.0    | ok       | OB_CLOUD   | 2002-07-04 to ongoing    | 329 / 276                          | 2003-01-01 .. 2025-12-01 | sea    |
| M2C0NXASM      | 5.12.4    | ok       | GES_DISC   | 1980-01-01 to 2020-12-31 | 1 / 1                              | 1980-01-01 .. 1980-01-01 | mask   |

## Non-CMR sources

| source                                     |   http |   bytes | url                                                                         |
|--------------------------------------------|--------|---------|-----------------------------------------------------------------------------|
| GISTEMP v4 global annual (GLB.Ts+dSST.csv) |    200 |   12887 | https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv             |
| NASA POWER API (fallback, labelled)        |    200 |    1327 | https://power.larc.nasa.gov/api/temporal/monthly/point                      |
| Natural Earth admin-0 (10m)                |    200 | 4930492 | https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_0_countries.zip |
| geoBoundaries KWT ADM1                     |    200 |    1731 | https://www.geoboundaries.org/api/current/gbOpen/KWT/ADM1/                  |
