import type { Restaurant } from './types'

// ─── EWKB parsing ────────────────────────────────────────────────────────────

const EWKB_LITTLE_ENDIAN = 1
const EWKB_SRID_FLAG = 0x20000000
const EWKB_BASE_OFFSET = 5
const EWKB_SRID_OFFSET = 9
const EWKB_DOUBLE_SIZE = 8

export function parseEWKBPoint(hex: string): [number, number] | null {
  try {
    const buf = Buffer.from(hex, 'hex')
    const le = buf[0] === EWKB_LITTLE_ENDIAN
    const wkbType = le ? buf.readUInt32LE(1) : buf.readUInt32BE(1)
    const offset = (wkbType & EWKB_SRID_FLAG) !== 0 ? EWKB_SRID_OFFSET : EWKB_BASE_OFFSET
    const x = le ? buf.readDoubleLE(offset) : buf.readDoubleBE(offset)
    const y = le ? buf.readDoubleLE(offset + EWKB_DOUBLE_SIZE) : buf.readDoubleBE(offset + EWKB_DOUBLE_SIZE)
    return [x, y]
  } catch {
    return null
  }
}

// ─── Tag filter ───────────────────────────────────────────────────────────────

export function filterByTagType(results: Restaurant[], names: string[], type: string): Restaurant[] {
  if (names.length === 0) return results
  return results.filter(r =>
    names.some(name => r.tags.some(t => t.name === name && t.type === type))
  )
}

// ─── Distance ────────────────────────────────────────────────────────────────

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}
