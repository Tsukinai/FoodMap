import { NextRequest, NextResponse } from 'next/server'
import { searchOneMap, parseOneMapResult } from '@/lib/onemap'

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')
  if (!query || query.trim().length < 2) {
    return NextResponse.json([])
  }

  const results = await searchOneMap(query.trim())
  const parsedResults = results.slice(0, 8).map(parseOneMapResult)
  // #region agent log
  fetch('http://127.0.0.1:7785/ingest/06f7814b-35b6-4caa-a074-dc046863fac3', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'bed6da' }, body: JSON.stringify({ sessionId: 'bed6da', runId: 'initial', hypothesisId: 'H4', location: 'app/api/geocode/route.ts:12', message: 'geocode parsed results', data: { queryLength: query.trim().length, resultCount: parsedResults.length, firstResult: parsedResults[0] ? { hasPostalCode: Boolean(parsedResults[0].postal_code), lng: parsedResults[0].lng, lat: parsedResults[0].lat, lngType: typeof parsedResults[0].lng, latType: typeof parsedResults[0].lat, lngIsFinite: Number.isFinite(parsedResults[0].lng), latIsFinite: Number.isFinite(parsedResults[0].lat) } : null }, timestamp: Date.now() }) }).catch(() => {})
  // #endregion
  return NextResponse.json(parsedResults)
}
