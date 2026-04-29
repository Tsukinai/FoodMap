import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const user = await requireOwner()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, type } = body

  if (!name || !type || !['cuisine', 'dish', 'taste', 'scene'].includes(type)) {
    return NextResponse.json({ error: 'Invalid tag data' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tags')
    .insert({ name: name.trim(), type })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      // unique constraint — return existing tag
      const { data: existing } = await supabase
        .from('tags')
        .select()
        .eq('name', name.trim())
        .eq('type', type)
        .single()
      return NextResponse.json(existing)
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
