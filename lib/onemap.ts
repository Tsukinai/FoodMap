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

export async function getPlanningArea(lat: number, lng: number): Promise<string | null> {
  const token = await getOneMapToken()
  if (!token) return null
  try {
    const res = await fetch(
      `https://www.onemap.gov.sg/api/public/planningarea/query?lat=${lat}&lng=${lng}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
    )
    if (!res.ok) return null
    const data = await res.json()
    const area = Array.isArray(data) ? data[0]?.pln_area_n : data?.pln_area_n
    return typeof area === 'string' ? area : null
  } catch {
    return null
  }
}

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
  // OneMap returns empty string for no results
  if (!data.results || data.results === 'NIL') return []

  return data.results as OneMapResult[]
}

export function parseOneMapResult(result: OneMapResult) {
  const lng = parseFloat(result.LONGITUDE)
  const lat = parseFloat(result.LATITUDE)
  return {
    address: result.ADDRESS,
    postal_code: result.POSTAL,
    // Note: API field is correctly spelled LONGITUDE (not LONGTITUDE as in some older docs)
    lng: Number.isFinite(lng) ? lng : null,
    lat: Number.isFinite(lat) ? lat : null,
  }
}
