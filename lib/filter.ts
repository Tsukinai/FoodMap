import type { Restaurant, Tag, TagType } from './types'

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

// Drop names that are not known cuisine/dish/taste/scene tags. Used on LLM tool
// output so a hallucinated tag name does not silently zero-out the result set.
export function partitionKnownTagNames(
  names: string[],
  type: TagType,
  allTags: Tag[],
): { kept: string[]; dropped: string[] } {
  const known = new Set(allTags.filter(t => t.type === type).map(t => t.name))
  const kept: string[] = []
  const dropped: string[] = []
  for (const n of names) (known.has(n) ? kept : dropped).push(n)
  return { kept, dropped }
}

// Expand parent cuisine names to include all their children (e.g. 中餐 → 中餐 +
// 粤菜 + 川菜 …). Other tag types have no hierarchy so don't need this.
export function expandCuisineTagNames(names: string[], allTags: Tag[]): string[] {
  if (names.length === 0) return names
  const cuisineByName = new Map(
    allTags.filter(t => t.type === 'cuisine').map(t => [t.name, t]),
  )
  const childrenByParent = new Map<string, string[]>()
  for (const t of allTags) {
    if (t.type !== 'cuisine' || !t.parent_id) continue
    const list = childrenByParent.get(t.parent_id) ?? []
    list.push(t.name)
    childrenByParent.set(t.parent_id, list)
  }
  const result = new Set(names)
  for (const name of names) {
    const tag = cuisineByName.get(name)
    if (!tag) continue
    for (const child of childrenByParent.get(tag.id) ?? []) result.add(child)
  }
  return Array.from(result)
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
