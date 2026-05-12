import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, requireOwner } from '@/lib/supabase/server'
import { getPlanningArea } from '@/lib/onemap'

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const owner = await requireOwner()
  if (!owner) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createAdminClient()

  const { data: req, error: fetchErr } = await supabase
    .from('pin_requests')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchErr || !req) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const planning_area = await getPlanningArea(req.lat, req.lng)

  const { data: restaurant, error: insertErr } = await supabase
    .from('restaurants')
    .insert({
      name: req.name,
      address: req.address,
      postal_code: req.postal_code ?? null,
      location: `POINT(${req.lng} ${req.lat})`,
      notes: req.notes,
      signature_dishes: [],
      status: 'want',
      rating: '未评分',
      planning_area: planning_area ?? null,
    })
    .select('id')
    .single()

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  const tagIds = [...(req.cuisine_tag_ids ?? []), ...(req.scene_tag_ids ?? [])]
  if (tagIds.length > 0) {
    await supabase.from('restaurant_tags').insert(
      tagIds.map((tag_id: string) => ({ restaurant_id: restaurant.id, tag_id }))
    )
  }

  await supabase.from('pin_requests').delete().eq('id', id)

  return NextResponse.json({ restaurant_id: restaurant.id }, { status: 201 })
}
