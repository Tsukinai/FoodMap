import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')
  if (!query || query.trim().length < 2) {
    return NextResponse.json([])
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing GOOGLE_PLACES_API_KEY' }, { status: 500 })
  }

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.addressComponents',
    },
    body: JSON.stringify({
      textQuery: query.trim(),
      locationBias: {
        circle: {
          center: { latitude: 1.3521, longitude: 103.8198 },
          radius: 50000,
        },
      },
      maxResultCount: 6,
    }),
  })

  if (!res.ok) return NextResponse.json([])

  const data = await res.json()
  const places: PlaceRaw[] = data.places ?? []

  return NextResponse.json(
    places.map((p) => {
      const postalComp = p.addressComponents?.find((c) => c.types?.includes('postal_code'))
      return {
        name: p.displayName?.text ?? '',
        address: p.formattedAddress ?? '',
        postal_code: postalComp?.longText ?? '',
        lat: p.location?.latitude ?? 0,
        lng: p.location?.longitude ?? 0,
      }
    })
  )
}

interface PlaceRaw {
  displayName?: { text: string }
  formattedAddress?: string
  location?: { latitude: number; longitude: number }
  addressComponents?: { types: string[]; longText: string }[]
}
