import { NextRequest, NextResponse } from 'next/server'
import { createClient, requireOwner } from '@/lib/supabase/server'
import { getPlanningArea } from '@/lib/onemap'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireOwner()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { name, address, postal_code, lng, lat, cost_min, cost_max, notes, signature_dishes, status, rating, cuisine_tag_ids, dish_tag_ids, taste_tag_ids, scene_tag_ids } = body

  const supabase = await createClient()

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (name !== undefined) updates.name = name
  if (address !== undefined) updates.address = address
  if (postal_code !== undefined) updates.postal_code = postal_code
  if (lng !== undefined && lat !== undefined) {
    updates.location = `POINT(${lng} ${lat})`
    updates.planning_area = await getPlanningArea(lat, lng) ?? null
  }
  if (cost_min !== undefined) updates.cost_min = cost_min
  if (cost_max !== undefined) updates.cost_max = cost_max
  if (notes !== undefined) updates.notes = notes
  if (signature_dishes !== undefined) updates.signature_dishes = signature_dishes
  if (status !== undefined) updates.status = status
  if (rating !== undefined) updates.rating = rating

  const { error } = await supabase.from('restaurants').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Replace tags if any tag array is provided — diff current vs desired to avoid full delete/re-insert
  if (cuisine_tag_ids !== undefined || dish_tag_ids !== undefined || taste_tag_ids !== undefined || scene_tag_ids !== undefined) {
    const newTagIds = new Set<string>([
      ...(cuisine_tag_ids ?? []),
      ...(dish_tag_ids ?? []),
      ...(taste_tag_ids ?? []),
      ...(scene_tag_ids ?? []),
    ])

    const { data: current } = await supabase
      .from('restaurant_tags')
      .select('tag_id')
      .eq('restaurant_id', id)

    const currentIds = new Set((current ?? []).map((r: { tag_id: string }) => r.tag_id))
    const toRemove = [...currentIds].filter((tid) => !newTagIds.has(tid))
    const toAdd = [...newTagIds].filter((tid) => !currentIds.has(tid))

    if (toRemove.length > 0) {
      const { error: delError } = await supabase
        .from('restaurant_tags')
        .delete()
        .eq('restaurant_id', id)
        .in('tag_id', toRemove)
      if (delError) return NextResponse.json({ error: delError.message }, { status: 500 })
    }

    if (toAdd.length > 0) {
      const { error: insError } = await supabase
        .from('restaurant_tags')
        .insert(toAdd.map((tag_id) => ({ restaurant_id: id, tag_id })))
      if (insError) return NextResponse.json({ error: insError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireOwner()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = await createClient()

  const { error } = await supabase.from('restaurants').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
