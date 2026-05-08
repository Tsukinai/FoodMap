import { describe, test, expect } from 'vitest'
import {
  parseEWKBPoint,
  filterByTagType,
  partitionKnownTagNames,
  expandCuisineTagNames,
  haversineKm,
} from './filter'
import type { Tag, Restaurant } from './types'

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeEWKBHex(lng: number, lat: number, withSRID = true): string {
  const buf = Buffer.allocUnsafe(withSRID ? 25 : 21)
  buf[0] = 1 // little-endian
  buf.writeUInt32LE(withSRID ? 0x20000001 : 1, 1)
  let offset = 5
  if (withSRID) {
    buf.writeUInt32LE(4326, 5)
    offset = 9
  }
  buf.writeDoubleLE(lng, offset)
  buf.writeDoubleLE(lat, offset + 8)
  return buf.toString('hex')
}

function makeTag(overrides: Partial<Tag> & { id: string; name: string; type: Tag['type'] }): Tag {
  return {
    parent_id: null,
    sort_order: 0,
    created_at: '',
    ...overrides,
  }
}

function makeRestaurant(tags: Tag[]): Restaurant {
  return {
    id: 'r1',
    name: 'Test',
    address: null,
    postal_code: null,
    location_lng: 103.8,
    location_lat: 1.3,
    cost_min: null,
    cost_max: null,
    notes: null,
    signature_dishes: [],
    status: 'visited',
    rating: '夯',
    planning_area: null,
    created_at: '',
    updated_at: '',
    tags,
  }
}

// ─── parseEWKBPoint ───────────────────────────────────────────────────────────

describe('parseEWKBPoint', () => {
  test('parses little-endian EWKB with SRID', () => {
    const hex = makeEWKBHex(103.8198, 1.3521)
    const result = parseEWKBPoint(hex)
    expect(result).not.toBeNull()
    expect(result![0]).toBeCloseTo(103.8198, 4)
    expect(result![1]).toBeCloseTo(1.3521, 4)
  })

  test('parses EWKB without SRID', () => {
    const hex = makeEWKBHex(103.9, 1.4, false)
    const result = parseEWKBPoint(hex)
    expect(result).not.toBeNull()
    expect(result![0]).toBeCloseTo(103.9, 4)
    expect(result![1]).toBeCloseTo(1.4, 4)
  })

  test('returns null for invalid hex', () => {
    expect(parseEWKBPoint('notvalid')).toBeNull()
    expect(parseEWKBPoint('')).toBeNull()
  })
})

// ─── filterByTagType ──────────────────────────────────────────────────────────

describe('filterByTagType', () => {
  const cuisineTag = makeTag({ id: 'c1', name: '中餐', type: 'cuisine' })
  const dishTag = makeTag({ id: 'd1', name: '烧鸭', type: 'dish' })
  const r1 = makeRestaurant([cuisineTag])
  const r2 = makeRestaurant([dishTag])

  test('empty names returns all', () => {
    expect(filterByTagType([r1, r2], [], 'cuisine')).toEqual([r1, r2])
  })

  test('filters to matching type and name', () => {
    expect(filterByTagType([r1, r2], ['中餐'], 'cuisine')).toEqual([r1])
  })

  test('no match returns empty array', () => {
    expect(filterByTagType([r1, r2], ['日料'], 'cuisine')).toEqual([])
  })

  test('ignores tags of different type', () => {
    expect(filterByTagType([r1, r2], ['烧鸭'], 'cuisine')).toEqual([])
    expect(filterByTagType([r1, r2], ['烧鸭'], 'dish')).toEqual([r2])
  })
})

// ─── partitionKnownTagNames ───────────────────────────────────────────────────

describe('partitionKnownTagNames', () => {
  const tags: Tag[] = [
    makeTag({ id: 'c1', name: '中餐', type: 'cuisine' }),
    makeTag({ id: 'c2', name: '日料', type: 'cuisine' }),
    makeTag({ id: 'd1', name: '烧鸭', type: 'dish' }),
  ]

  test('separates known from unknown', () => {
    const { kept, dropped } = partitionKnownTagNames(['中餐', '幻觉料理'], 'cuisine', tags)
    expect(kept).toEqual(['中餐'])
    expect(dropped).toEqual(['幻觉料理'])
  })

  test('does not cross tag types', () => {
    const { kept, dropped } = partitionKnownTagNames(['烧鸭'], 'cuisine', tags)
    expect(kept).toEqual([])
    expect(dropped).toEqual(['烧鸭'])
  })

  test('empty input returns empty', () => {
    const { kept, dropped } = partitionKnownTagNames([], 'cuisine', tags)
    expect(kept).toEqual([])
    expect(dropped).toEqual([])
  })
})

// ─── expandCuisineTagNames ────────────────────────────────────────────────────

describe('expandCuisineTagNames', () => {
  const parent = makeTag({ id: 'p1', name: '中餐', type: 'cuisine' })
  const child1 = makeTag({ id: 'c1', name: '粤菜', type: 'cuisine', parent_id: 'p1' })
  const child2 = makeTag({ id: 'c2', name: '川菜', type: 'cuisine', parent_id: 'p1' })
  const standalone = makeTag({ id: 's1', name: '日料', type: 'cuisine' })
  const allTags = [parent, child1, child2, standalone]

  test('empty returns empty', () => {
    expect(expandCuisineTagNames([], allTags)).toEqual([])
  })

  test('parent expands to include children', () => {
    const result = expandCuisineTagNames(['中餐'], allTags)
    expect(result).toContain('中餐')
    expect(result).toContain('粤菜')
    expect(result).toContain('川菜')
    expect(result).toHaveLength(3)
  })

  test('standalone tag is unchanged', () => {
    expect(expandCuisineTagNames(['日料'], allTags)).toEqual(['日料'])
  })

  test('child tag selected directly is not expanded further', () => {
    expect(expandCuisineTagNames(['粤菜'], allTags)).toEqual(['粤菜'])
  })
})

// ─── haversineKm ─────────────────────────────────────────────────────────────

describe('haversineKm', () => {
  test('same point is 0', () => {
    expect(haversineKm(1.3, 103.8, 1.3, 103.8)).toBe(0)
  })

  test('known distance: Orchard ↔ Marina Bay (~4.7 km)', () => {
    // Orchard MRT: 1.3040, 103.8318 — Marina Bay MRT: 1.2766, 103.8558
    const km = haversineKm(1.304, 103.8318, 1.2766, 103.8558)
    expect(km).toBeGreaterThan(3.5)
    expect(km).toBeLessThan(5.5)
  })

  test('symmetric: A→B equals B→A', () => {
    const ab = haversineKm(1.3, 103.8, 1.35, 103.85)
    const ba = haversineKm(1.35, 103.85, 1.3, 103.8)
    expect(ab).toBeCloseTo(ba, 10)
  })
})
