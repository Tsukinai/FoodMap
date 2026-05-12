import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient, requireOwner } from '@/lib/supabase/server'

export async function GET() {
  const owner = await requireOwner()
  if (!owner) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('pin_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, address, postal_code, lng, lat, cuisine_tag_ids, scene_tag_ids, notes } = body

  if (!name?.trim() || !address?.trim() || typeof lng !== 'number' || typeof lat !== 'number' || !notes?.trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (!Array.isArray(cuisine_tag_ids) || cuisine_tag_ids.length === 0) {
    return NextResponse.json({ error: '菜系必填' }, { status: 400 })
  }
  if (!Array.isArray(scene_tag_ids) || scene_tag_ids.length === 0) {
    return NextResponse.json({ error: '场合必填' }, { status: 400 })
  }

  const author_name = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? 'Anonymous'
  const author_avatar = user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('pin_requests')
    .insert({
      user_id: user.id,
      author_name,
      author_avatar,
      name: name.trim(),
      address: address.trim(),
      postal_code: postal_code || null,
      lng,
      lat,
      cuisine_tag_ids,
      scene_tag_ids,
      notes: notes.trim(),
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
