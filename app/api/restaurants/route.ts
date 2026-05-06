import { NextRequest, NextResponse } from 'next/server'
import { createClient, requireOwner } from '@/lib/supabase/server'
import { getPlanningArea } from '@/lib/onemap'
import type { Restaurant, TagType } from '@/lib/types'

interface DbTag {
  id: string
  name: string
  type: TagType
  parent_id: string | null
  sort_order: number
  created_at: string
}

interface DbRestaurantRow {
  id: string
  name: string
  address: string | null
  postal_code: string | null
  planning_area: string | null
  location: string | null
  cost_min: number | null
  cost_max: number | null
  notes: string | null
  signature_dishes: string[]
  status: string
  rating: string
  created_at: string
  updated_at: string
  restaurant_tags: Array<{ tags: DbTag | null }>
}

function filterByTagType(results: Restaurant[], names: string[], type: string): Restaurant[] {
  if (names.length === 0) return results
  return results.filter((r) =>
    names.some((name) => r.tags.some((t) => t.name === name && t.type === type))
  )
}

// EWKB binary layout constants
const EWKB_LITTLE_ENDIAN = 1
const EWKB_SRID_FLAG = 0x20000000
const EWKB_BASE_OFFSET = 5   // 1 byte (byte order) + 4 bytes (type)
const EWKB_SRID_OFFSET = 9   // EWKB_BASE_OFFSET + 4 bytes (SRID)
const EWKB_DOUBLE_SIZE = 8

function parseEWKBPoint(hex: string): [number, number] | null {
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

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const cuisineTags = searchParams.get('cuisine_tags')?.split(',').filter(Boolean) ?? []
  const dishTags = searchParams.get('dish_tags')?.split(',').filter(Boolean) ?? []
  const tasteTags = searchParams.get('taste_tags')?.split(',').filter(Boolean) ?? []
  const sceneTags = searchParams.get('scene_tags')?.split(',').filter(Boolean) ?? []
  const maxCostRaw = Number(searchParams.get('max_cost'))
  const minCostRaw = Number(searchParams.get('min_cost'))
  const maxCost = searchParams.get('max_cost') && Number.isFinite(maxCostRaw) ? maxCostRaw : null
  const minCost = searchParams.get('min_cost') && Number.isFinite(minCostRaw) ? minCostRaw : null
  const VALID_STATUSES = new Set(['want', 'visited'])
  const statusFilter = (searchParams.get('status')?.split(',').filter(Boolean) ?? []).filter(s => VALID_STATUSES.has(s))
  const ratingsFilter = searchParams.get('ratings')?.split(',').filter(Boolean) ?? []

  const supabase = await createClient()

  let query = supabase
    .from('restaurants')
    .select(`
      id, name, address, postal_code, planning_area,
      location,
      cost_min, cost_max, notes, signature_dishes, status, rating, created_at, updated_at,
      restaurant_tags (
        tags ( id, name, type, parent_id, sort_order, created_at )
      )
    `)

  if (maxCost !== null) query = query.lte('cost_max', maxCost)
  if (minCost !== null) query = query.gte('cost_min', minCost)
  if (statusFilter.length === 1) query = query.eq('status', statusFilter[0])

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Filter by tag IDs (post-query since Supabase JS doesn't support junction filtering easily)
  // PostgREST returns geography columns as GeoJSON objects
  // data shape matches DbRestaurantRow — see interface above
  let results: Restaurant[] = ((data ?? []) as any[]).map((r: DbRestaurantRow) => {
    const coords = typeof r.location === 'string' ? parseEWKBPoint(r.location) : null
    return {
      id: r.id,
      name: r.name,
      address: r.address,
      postal_code: r.postal_code,
      planning_area: r.planning_area,
      location_lng: coords?.[0] ?? 0,
      location_lat: coords?.[1] ?? 0,
      cost_min: r.cost_min,
      cost_max: r.cost_max,
      notes: r.notes,
      signature_dishes: r.signature_dishes ?? [],
      status: (r.status ?? 'visited') as Restaurant['status'],
      rating: (r.rating ?? '未评分') as Restaurant['rating'],
      created_at: r.created_at,
      updated_at: r.updated_at,
      tags: (r.restaurant_tags ?? []).map((rt) => rt.tags).filter((t): t is DbTag => Boolean(t)),
    } satisfies Restaurant
  })

  const tagFilters: [string[], string][] = [
    [cuisineTags, 'cuisine'],
    [dishTags, 'dish'],
    [tasteTags, 'taste'],
    [sceneTags, 'scene'],
  ]
  for (const [names, type] of tagFilters) {
    results = filterByTagType(results, names, type)
  }

  if (ratingsFilter.length > 0) {
    results = results.filter((r: any) => ratingsFilter.includes(r.rating))
  }

  return NextResponse.json(results)
}

export async function POST(request: NextRequest) {
  const user = await requireOwner()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, address, postal_code, lng, lat, cost_min, cost_max, notes, signature_dishes, status, rating, cuisine_tag_ids, dish_tag_ids, taste_tag_ids, scene_tag_ids } = body

  if (!name || typeof lng !== 'number' || typeof lat !== 'number') {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = await createClient()
  const planning_area = await getPlanningArea(lat, lng)

  const { data: restaurant, error } = await supabase
    .from('restaurants')
    .insert({
      name,
      address: address || null,
      postal_code: postal_code || null,
      location: `POINT(${lng} ${lat})`,
      cost_min: cost_min || null,
      cost_max: cost_max || null,
      notes: notes || null,
      signature_dishes: signature_dishes ?? [],
      status: status ?? 'visited',
      rating: rating ?? '未评分',
      planning_area: planning_area ?? null,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const tagIds = [
    ...(cuisine_tag_ids ?? []),
    ...(dish_tag_ids ?? []),
    ...(taste_tag_ids ?? []),
    ...(scene_tag_ids ?? []),
  ].filter((id: string) => !id.startsWith('preset-'))
  if (tagIds.length > 0) {
    await supabase.from('restaurant_tags').insert(
      tagIds.map((tag_id: string) => ({ restaurant_id: restaurant.id, tag_id }))
    )
  }

  return NextResponse.json({ id: restaurant.id }, { status: 201 })
}
