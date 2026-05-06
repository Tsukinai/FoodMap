import type { OneMapResult } from './types'

const ONEMAP_SEARCH_URL = 'https://www.onemap.gov.sg/api/common/elastic/search'

// ─── Token management ────────────────────────────────────────────────────────
let _tokenCache: { token: string; expiresAt: number } | null = null

async function getOneMapToken(): Promise<string | null> {
  const now = Date.now()
  if (_tokenCache && _tokenCache.expiresAt - now > 86_400_000) return _tokenCache.token
  const email = process.env.ONEMAP_EMAIL
  const password = process.env.ONEMAP_PASSWORD
  if (!email || !password) return null
  try {
    const res = await fetch('https://www.onemap.gov.sg/api/auth/post/getToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json()
    _tokenCache = {
      token: data.access_token,
      expiresAt: Number(data.expiry_timestamp) * 1000,
    }
    return _tokenCache.token
  } catch {
    return null
  }
}

// ─── Planning area (point-in-polygon) ────────────────────────────────────────
// /api/public/popapi/getPlanningArea (by lat/lon) requires a paid account tier.
// Instead we fetch all 55 area polygons once and do a local PiP check.

type MultiPolygon = { type: 'MultiPolygon'; coordinates: number[][][][] }
type PlanningAreaEntry = { pln_area_n: string; geojson: MultiPolygon }
let _areaCache: { areas: PlanningAreaEntry[]; fetchedAt: number } | null = null

async function fetchAllPlanningAreas(): Promise<PlanningAreaEntry[] | null> {
  const now = Date.now()
  if (_areaCache && now - _areaCache.fetchedAt < 86_400_000) return _areaCache.areas

  const token = await getOneMapToken()
  if (!token) return null
  try {
    const res = await fetch(
      'https://www.onemap.gov.sg/api/public/popapi/getAllPlanningarea',
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
    )
    if (!res.ok) return null
    const data = await res.json()
    const raw: { pln_area_n: string; geojson: string }[] = data?.SearchResults
    if (!Array.isArray(raw)) return null
    const areas = raw.map(r => ({ pln_area_n: r.pln_area_n, geojson: JSON.parse(r.geojson) as MultiPolygon }))
    _areaCache = { areas, fetchedAt: now }
    return areas
  } catch {
    return null
  }
}

function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

export async function getPlanningArea(lat: number, lng: number): Promise<string | null> {
  const areas = await fetchAllPlanningAreas()
  if (!areas) return null
  for (const area of areas) {
    if (area.geojson.coordinates.some(polygon => pointInRing(lng, lat, polygon[0]))) {
      return area.pln_area_n
    }
  }
  return null
}

// ─── Address search ───────────────────────────────────────────────────────────
export async function searchOneMap(query: string): Promise<OneMapResult[]> {
  const params = new URLSearchParams({
    searchVal: query,
    returnGeom: 'Y',
    getAddrDetails: 'Y',
    pageNum: '1',
  })

  const res = await fetch(`${ONEMAP_SEARCH_URL}?${params}`, {
    next: { revalidate: 60 },
  })

  if (!res.ok) return []

  const data = await res.json()
  if (!data.results || data.results === 'NIL') return []

  return data.results as OneMapResult[]
}

export function parseOneMapResult(result: OneMapResult) {
  const lng = parseFloat(result.LONGITUDE)
  const lat = parseFloat(result.LATITUDE)
  return {
    address: result.ADDRESS,
    postal_code: result.POSTAL,
    lng: Number.isFinite(lng) ? lng : null,
    lat: Number.isFinite(lat) ? lat : null,
  }
}
