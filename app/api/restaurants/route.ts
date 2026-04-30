import { NextRequest, NextResponse } from 'next/server'
import { createClient, requireOwner } from '@/lib/supabase/server'
import { REGION_BOUNDS } from '@/lib/constants'

function parseEWKBPoint(hex: string): [number, number] | null {
  try {
    const buf = Buffer.from(hex, 'hex')
    const le = buf[0] === 1
    const wkbType = le ? buf.readUInt32LE(1) : buf.readUInt32BE(1)
    const hasSRID = (wkbType & 0x20000000) !== 0
    const offset = hasSRID ? 9 : 5
    const x = le ? buf.readDoubleLE(offset) : buf.readDoubleBE(offset)
    const y = le ? buf.readDoubleLE(offset + 8) : buf.readDoubleBE(offset + 8)
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
  const maxCost = searchParams.get('max_cost') ? Number(searchParams.get('max_cost')) : null
  const minCost = searchParams.get('min_cost') ? Number(searchParams.get('min_cost')) : null
  const regions = searchParams.get('regions')?.split(',').filter(Boolean) ?? []
  const areaKeyword = searchParams.get('area_keyword') ?? null
  const statusFilter = searchParams.get('status')?.split(',').filter(Boolean) ?? []

  const supabase = await createClient()

  let query = supabase
    .from('restaurants')
    .select(`
      id, name, address, postal_code,
      location,
      cost_min, cost_max, notes, signature_dishes, status, created_at, updated_at,
      restaurant_tags (
        tags ( id, name, type )
      )
    `)

  if (maxCost !== null) query = query.lte('cost_max', maxCost)
  if (minCost !== null) query = query.gte('cost_min', minCost)
  if (areaKeyword) query = query.ilike('address', `%${areaKeyword}%`)
  if (statusFilter.length === 1) query = query.eq('status', statusFilter[0])

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Filter by tag IDs (post-query since Supabase JS doesn't support junction filtering easily)
  // PostgREST returns geography columns as GeoJSON objects
  let results = (data ?? []).map((r: any) => {
    const coords = typeof r.location === 'string' ? parseEWKBPoint(r.location) : null
    return {
      ...r,
      location_lng: coords?.[0] ?? null,
      location_lat: coords?.[1] ?? null,
      location: undefined,
      signature_dishes: r.signature_dishes ?? [],
      status: r.status ?? 'visited',
      tags: r.restaurant_tags?.map((rt: any) => rt.tags).filter(Boolean) ?? [],
      restaurant_tags: undefined,
    }
  })

  if (cuisineTags.length > 0) {
    results = results.filter((r: any) =>
      cuisineTags.some((name) =>
        r.tags.some((t: any) => t.name === name && t.type === 'cuisine')
      )
    )
  }

  if (dishTags.length > 0) {
    results = results.filter((r: any) =>
      dishTags.some((name) =>
        r.tags.some((t: any) => t.name === name && t.type === 'dish')
      )
    )
  }

  if (tasteTags.length > 0) {
    results = results.filter((r: any) =>
      tasteTags.some((name) =>
        r.tags.some((t: any) => t.name === name && t.type === 'taste')
      )
    )
  }

  if (sceneTags.length > 0) {
    results = results.filter((r: any) =>
      sceneTags.some((name) =>
        r.tags.some((t: any) => t.name === name && t.type === 'scene')
      )
    )
  }

  if (regions.length > 0) {
    results = results.filter((r: any) => {
      const lng = r.location_lng
      const lat = r.location_lat
      return regions.some((region) => {
        const bounds = REGION_BOUNDS[region]
        if (!bounds) return false
        const [west, south, east, north] = bounds
        return lng >= west && lng <= east && lat >= south && lat <= north
      })
    })
  }

  return NextResponse.json(results)
}

export async function POST(request: NextRequest) {
  const user = await requireOwner()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, address, postal_code, lng, lat, cost_min, cost_max, notes, signature_dishes, status, cuisine_tag_ids, dish_tag_ids, taste_tag_ids, scene_tag_ids } = body

  if (!name || typeof lng !== 'number' || typeof lat !== 'number') {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = await createClient()

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
