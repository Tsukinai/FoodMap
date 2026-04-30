import { NextRequest, NextResponse } from 'next/server'
import { createClient, requireOwner } from '@/lib/supabase/server'

export async function PUT(request: NextRequest) {
  const user = await requireOwner()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { ids } = body
  if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string')) {
    return NextResponse.json({ error: 'Invalid ids' }, { status: 400 })
  }

  const supabase = await createClient()
  await Promise.all(
    ids.map((id: string, index: number) =>
      supabase.from('tags').update({ sort_order: index }).eq('id', id)
    )
  )

  return NextResponse.json({ success: true })
}
