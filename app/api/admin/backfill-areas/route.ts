import { NextResponse } from 'next/server'
import { createClient, requireOwner } from '@/lib/supabase/server'
import { getPlanningArea } from '@/lib/onemap'

export async function POST() {
  const user = await requireOwner()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { data: rows, error } = await supabase
    .from('restaurants')
    .select('id, location')
    .is('planning_area', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!rows?.length) return NextResponse.json({ updated: 0, total: 0 })

  let updated = 0
  for (const row of rows) {
    const coords = parseEWKBPoint(row.location)
    if (!coords) continue
    const [lng, lat] = coords
    const area = await getPlanningArea(lat, lng)
    if (!area) continue
    await supabase.from('restaurants').update({ planning_area: area }).eq('id', row.id)
    updated++
  }

  return NextResponse.json({ updated, total: rows.length })
}

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
