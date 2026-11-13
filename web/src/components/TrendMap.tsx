import { useMemo } from 'react'
import { GeoJSON, MapContainer, Rectangle, TileLayer, Tooltip } from 'react-leaflet'
import type { GeoJsonObject } from 'geojson'
import 'leaflet/dist/leaflet.css'
import { useJson } from '../data'
import { useLang } from '../lang'
import type { MapGrid } from '../types'

// blue (decrease) -> paper white (0) -> red (increase)
const STOPS: [number, number, number][] = [
  [31, 95, 139],
  [143, 184, 214],
  [247, 241, 227],
  [232, 149, 107],
  [164, 38, 44],
]
function diverge(x: number): string {
  // x in [-1, 1]
  const p = (Math.max(-1, Math.min(1, x)) + 1) / 2 * (STOPS.length - 1)
  const i = Math.min(STOPS.length - 2, Math.floor(p))
  const f = p - i
  const c = STOPS[i].map((a, k) => Math.round(a + (STOPS[i + 1][k] - a) * f))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

function step(a: number[]): number {
  return a.length > 1 ? Math.abs(a[1] - a[0]) : 0.05
}

function Grid({ g }: { g: MapGrid }) {
  const cells = useMemo(() => {
    const dx = step(g.lon) / 2
    const dy = step(g.lat) / 2
    let maxAbs = 0
    g.slope_per_decade.forEach((row) => row.forEach((v) => v !== null && (maxAbs = Math.max(maxAbs, Math.abs(v)))))
    maxAbs = maxAbs || 1
    const out: { key: string; b: [[number, number], [number, number]]; color: string; sig: boolean; slope: number; p: number | null }[] = []
    g.lat.forEach((la, r) =>
      g.lon.forEach((lo, c) => {
        const s = g.slope_per_decade[r]?.[c]
        if (s === null || s === undefined) return
        out.push({
          key: `${r}-${c}`,
          b: [[la - dy, lo - dx], [la + dy, lo + dx]],
          color: diverge(s / maxAbs),
          sig: g.significant[r]?.[c] === true,
          slope: s,
          p: g.p_value[r]?.[c] ?? null,
        })
      }),
    )
    return { out, maxAbs }
  }, [g])
  return (
    <>
      {cells.out.map((c) => (
        <Rectangle
          key={c.key}
          bounds={c.b}
          pathOptions={{ stroke: false, fillColor: c.color, fillOpacity: c.sig ? 0.85 : 0.18 }}
        >
          <Tooltip sticky>
            {c.slope.toFixed(3)} {g.unit_per_decade}
            {c.p !== null ? `, p=${c.p.toFixed(3)}` : ''}
            {c.sig ? '' : ' (n.s.)'}
          </Tooltip>
        </Rectangle>
      ))}
    </>
  )
}

export function TrendMap({ caseId, variableId }: { caseId: string; variableId: string }) {
  const { t } = useLang()
  const kuwait = useJson<GeoJsonObject>('geo/kuwait.geojson')
  const govs = useJson<GeoJsonObject>('geo/governorates.geojson')
  const grid = useJson<MapGrid>(`maps/${caseId}_${variableId}.json`)
  return (
    <figure className="chart">
      <figcaption>
        <h3>{t('mapHeading')}</h3>
        <p className="note">{t('mapNote')}</p>
      </figcaption>
      <div className="map-wrap">
        <MapContainer center={[29.3, 47.9]} zoom={7} scrollWheelZoom={false} style={{ height: 420, width: '100%' }}>
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            opacity={0.55}
          />
          {govs.state === 'ok' && (
            <GeoJSON data={govs.data} style={{ color: '#7a6a50', weight: 1, dashArray: '4 3', fill: false }} />
          )}
          {grid.state === 'ok' && <Grid g={grid.data} />}
          {kuwait.state === 'ok' && (
            <GeoJSON data={kuwait.data} style={{ color: INK, weight: 2.5, fill: false }} />
          )}
        </MapContainer>
      </div>
      {grid.state === 'ok' ? (
        <div className="legend">
          <span>{t('legendDecrease')}</span>
          <span className="ramp" />
          <span>{t('legendIncrease')}</span>
          <span className="faded">{t('legendFaded')}</span>
        </div>
      ) : grid.state === 'unavailable' ? (
        <p className="note">{t('mapNoGrid')}</p>
      ) : null}
    </figure>
  )
}

const INK = '#2b2118'
