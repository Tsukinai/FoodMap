import { NextResponse } from 'next/server'
import { createClient, requireOwner } from '@/lib/supabase/server'
import { getPlanningArea } from '@/lib/onemap'

export async function GET() {
  const user = await requireOwner()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = process.env.ONEMAP_EMAIL
  const password = process.env.ONEMAP_PASSWORD
  if (!email || !password) return NextResponse.json({ error: 'missing credentials' })

  const tokenRes = await fetch('https://www.onemap.gov.sg/api/auth/post/getToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    cache: 'no-store',
  })
  const tokenData = await tokenRes.json()
  const token = tokenData.access_token
  if (!token) return NextResponse.json({ tokenStatus: tokenRes.status, tokenData })

  const areaResult = await fetch(
    'https://www.onemap.gov.sg/api/public/popapi/getAllPlanningarea',
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
  )
    .then(async r => {
      const data = await r.json().catch(() => null)
      const count = Array.isArray(data?.SearchResults) ? data.SearchResults.length : null
      return { status: r.status, count }
    })
    .catch((e: unknown) => ({ status: 0, count: null, error: String(e) }))

  return NextResponse.json({ tokenOk: true, area: areaResult })
}

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
  let coordsFailed = 0
  let areaFailed = 0
  for (const row of rows) {
    const coords = parseEWKBPoint(row.location)
    if (!coords) { coordsFailed++; continue }
    const [lng, lat] = coords
    const area = await getPlanningArea(lat, lng)
    if (!area) { areaFailed++; continue }
    await supabase.from('restaurants').update({ planning_area: area }).eq('id', row.id)
    updated++
  }

  return NextResponse.json({
    updated, total: rows.length, coordsFailed, areaFailed,
    hasCredentials: !!(process.env.ONEMAP_EMAIL && process.env.ONEMAP_PASSWORD),
  })
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
