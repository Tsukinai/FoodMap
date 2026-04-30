import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('messages')
    .select('id, user_id, author_name, author_avatar, content, reply, replied_at, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const content = (body.content ?? '').trim()
  if (!content) return NextResponse.json({ error: 'Content required' }, { status: 400 })

  const author_name = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? 'Anonymous'
  const author_avatar = user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null

  const { data, error } = await supabase
    .from('messages')
    .insert({ user_id: user.id, author_name, author_avatar, content })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
