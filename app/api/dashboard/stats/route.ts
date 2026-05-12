import { NextResponse } from 'next/server'
import { requireOwner, createAdminClient } from '@/lib/supabase/server'
import { RATING_ORDER } from '@/lib/types'

interface DbTag {
  name: string
  type: string
}

interface DbRow {
  id: string
  name: string
  status: string
  rating: string
  planning_area: string | null
  cost_min: number | null
  cost_max: number | null
  created_at: string
  restaurant_tags: Array<{ tags: DbTag | null }>
}

export interface DashboardStats {
  total: number
  visited: number
  want: number
  avgCostMin: number | null
  avgCostMax: number | null
  byRating: Array<{ rating: string; count: number }>
  byCuisine: Array<{ name: string; count: number }>
  byArea: Array<{ area: string; count: number }>
  byTaste: Array<{ name: string; count: number }>
  byScene: Array<{ name: string; count: number }>
  recent: Array<{ id: string; name: string; status: string; rating: string; created_at: string }>
}

export async function GET() {
  const owner = await requireOwner()
  if (!owner) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('restaurants')
    .select(`
      id, name, status, rating, planning_area, cost_min, cost_max, created_at,
      restaurant_tags(tags(name, type))
    `)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []) as unknown as DbRow[]

  const total = rows.length
  const visited = rows.filter(r => r.status === 'visited').length
  const want = rows.filter(r => r.status === 'want').length

  const withCostMin = rows.filter(r => r.cost_min != null)
  const withCostMax = rows.filter(r => r.cost_max != null)
  const avgCostMin = withCostMin.length > 0
    ? Math.round(withCostMin.reduce((s, r) => s + r.cost_min!, 0) / withCostMin.length)
    : null
  const avgCostMax = withCostMax.length > 0
    ? Math.round(withCostMax.reduce((s, r) => s + r.cost_max!, 0) / withCostMax.length)
    : null

  const ratingCounts = new Map<string, number>()
  RATING_ORDER.forEach(r => ratingCounts.set(r, 0))
  rows.forEach(r => {
    if (ratingCounts.has(r.rating)) ratingCounts.set(r.rating, ratingCounts.get(r.rating)! + 1)
  })
  const byRating = RATING_ORDER.map(rating => ({ rating, count: ratingCounts.get(rating) ?? 0 }))

  const cuisineCounts = new Map<string, number>()
  const tasteCounts = new Map<string, number>()
  const sceneCounts = new Map<string, number>()
  rows.forEach(r => {
    ;(r.restaurant_tags ?? []).forEach(rt => {
      const tag = rt.tags
      if (!tag) return
      if (tag.type === 'cuisine') cuisineCounts.set(tag.name, (cuisineCounts.get(tag.name) ?? 0) + 1)
      if (tag.type === 'taste') tasteCounts.set(tag.name, (tasteCounts.get(tag.name) ?? 0) + 1)
      if (tag.type === 'scene') sceneCounts.set(tag.name, (sceneCounts.get(tag.name) ?? 0) + 1)
    })
  })

  const toSorted = (map: Map<string, number>) =>
    Array.from(map.entries()).sort((a, b) => b[1] - a[1])

  const byCuisine = toSorted(cuisineCounts).slice(0, 12).map(([name, count]) => ({ name, count }))
  const byTaste = toSorted(tasteCounts).map(([name, count]) => ({ name, count }))
  const byScene = toSorted(sceneCounts).map(([name, count]) => ({ name, count }))

  const areaCounts = new Map<string, number>()
  rows.forEach(r => {
    if (r.planning_area) areaCounts.set(r.planning_area, (areaCounts.get(r.planning_area) ?? 0) + 1)
  })
  const byArea = toSorted(areaCounts).slice(0, 10).map(([area, count]) => ({ area, count }))

  const recent = rows.slice(0, 5).map(r => ({
    id: r.id,
    name: r.name,
    status: r.status,
    rating: r.rating,
    created_at: r.created_at,
  }))

  const stats: DashboardStats = {
    total, visited, want, avgCostMin, avgCostMax,
    byRating, byCuisine, byArea, byTaste, byScene, recent,
  }

  return NextResponse.json(stats)
}
