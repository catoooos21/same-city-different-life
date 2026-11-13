export function fmtP(p: number): string {
  if (p < 0.001) return 'p < 0.001'
  if (p < 0.1) return `p = ${p.toFixed(3)}`
  return `p = ${p.toFixed(2)}`
}

export function fmtNum(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '–'
  return v.toFixed(digits)
}

export function fmtSigned(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '–'
  const s = v.toFixed(digits)
  return v > 0 ? `+${s}` : s
}

export function plural(n: number, one: string, many: string): string {
  return Math.round(n) === 1 ? one : many
}
