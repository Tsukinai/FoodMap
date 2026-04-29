import type { OneMapResult } from './types'

const ONEMAP_SEARCH_URL = 'https://www.onemap.gov.sg/api/common/elastic/search'

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
  return {
    address: result.ADDRESS,
    postal_code: result.POSTAL,
    // Note: API field is correctly spelled LONGITUDE (not LONGTITUDE as in some older docs)
    lng: parseFloat(result.LONGITUDE),
    lat: parseFloat(result.LATITUDE),
  }
}
