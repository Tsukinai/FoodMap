import { NextRequest, NextResponse } from 'next/server'
import { searchOneMap, parseOneMapResult } from '@/lib/onemap'

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')
  if (!query || query.trim().length < 2) {
    return NextResponse.json([])
  }

  const results = await searchOneMap(query.trim())
  const parsedResults = results.slice(0, 8).map(parseOneMapResult)
  return NextResponse.json(parsedResults)
}
