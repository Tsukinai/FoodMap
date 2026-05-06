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

  // Replace tags if provided — backup current rows so we can restore on insert failure
  if (cuisine_tag_ids !== undefined || dish_tag_ids !== undefined || taste_tag_ids !== undefined || scene_tag_ids !== undefined) {
    const { data: backup } = await supabase
      .from('restaurant_tags')
      .select('tag_id')
      .eq('restaurant_id', id)

    await supabase.from('restaurant_tags').delete().eq('restaurant_id', id)

    const tagIds = [
      ...(cuisine_tag_ids ?? []),
      ...(dish_tag_ids ?? []),
      ...(taste_tag_ids ?? []),
      ...(scene_tag_ids ?? []),
    ]
    if (tagIds.length > 0) {
      const { error: insertError } = await supabase.from('restaurant_tags').insert(
        tagIds.map((tag_id: string) => ({ restaurant_id: id, tag_id }))
      )
      if (insertError) {
        if (backup?.length) {
          await supabase.from('restaurant_tags').insert(
            backup.map(t => ({ restaurant_id: id, tag_id: t.tag_id }))
          )
        }
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }
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
