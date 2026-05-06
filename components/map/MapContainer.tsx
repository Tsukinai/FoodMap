'use client'

import { useRef, useState, useEffect, useMemo } from 'react'
import Map, { NavigationControl, type MapRef } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { SINGAPORE_CENTER, SINGAPORE_ZOOM, SINGAPORE_BOUNDS } from '@/lib/constants'
import type { Restaurant, FilterPayload } from '@/lib/types'
import PinMarker from './PinMarker'

const SPIDERFY_RADIUS = 30

interface PinGroupInfo {
  groupKey: string
  groupSize: number
  pixelOffset: [number, number]
}

function computeGroupInfo(
  restaurants: Restaurant[],
  spiderfiedKey: string | null
): Record<string, PinGroupInfo> {
  const groups: Record<string, Restaurant[]> = {}
  for (const r of restaurants) {
    const key = `${r.location_lng},${r.location_lat}`
    if (!groups[key]) groups[key] = []
    groups[key].push(r)
  }
  const result: Record<string, PinGroupInfo> = {}
  for (const [key, group] of Object.entries(groups)) {
    const expanded = spiderfiedKey === key && group.length > 1
    group.forEach((r, i) => {
      let pixelOffset: [number, number] = [0, 0]
      if (expanded) {
        const angle = (i / group.length) * 2 * Math.PI - Math.PI / 2
        pixelOffset = [
          Math.round(SPIDERFY_RADIUS * Math.cos(angle)),
          Math.round(SPIDERFY_RADIUS * Math.sin(angle)),
        ]
      }
      result[r.id] = { groupKey: key, groupSize: group.length, pixelOffset }
    })
  }
  return result
}
import AddPinModal from './AddPinModal'

// CartoDB Voyager — warm, clean, free, no API key needed
const MAP_STYLE = {
  version: 8 as const,
  sources: {
    carto: {
      type: 'raster' as const,
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        'https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      ],
      tileSize: 256,
      attribution:
        '© <a href="https://carto.com/attributions">CartoDB</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  },
  layers: [{ id: 'carto-layer', type: 'raster' as const, source: 'carto' }],
}

interface Props {
  restaurants: Restaurant[]
  isOwner: boolean
  filters: FilterPayload
  addingPin: boolean
  onAddingPinChange: (v: boolean) => void
  onRestaurantSaved: () => void
  editMode: boolean
}

export default function MapContainer({
  restaurants,
  isOwner,
  filters,
  addingPin,
  onAddingPinChange,
  onRestaurantSaved,
  editMode,
}: Props) {
  const mapRef = useRef<MapRef>(null)
  const [addPinCoords, setAddPinCoords] = useState<{ lng: number; lat: number } | null>(null)
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null)
  const [editRestaurant, setEditRestaurant] = useState<Restaurant | null>(null)
  const [spiderfiedKey, setSpiderfiedKey] = useState<string | null>(null)

  useEffect(() => {
    if (addingPin) {
      setAddPinCoords({ lng: SINGAPORE_CENTER.lng, lat: SINGAPORE_CENTER.lat })
      onAddingPinChange(false)
    }
  }, [addingPin, onAddingPinChange])

  const groupInfo = useMemo(() => computeGroupInfo(restaurants, spiderfiedKey), [restaurants, spiderfiedKey])

  function handlePinClick(r: Restaurant) {
    const { groupKey, groupSize } = groupInfo[r.id]
    if (groupSize > 1 && spiderfiedKey !== groupKey) {
      setSpiderfiedKey(groupKey)
      setSelectedRestaurant(null)
    } else {
      setSelectedRestaurant(r.id === selectedRestaurant?.id ? null : r)
    }
  }

  function handleMapClick() {
    setSpiderfiedKey(null)
    setSelectedRestaurant(null)
  }

  return (
    <div className="relative w-full h-full">
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: SINGAPORE_CENTER.lng,
          latitude: SINGAPORE_CENTER.lat,
          zoom: SINGAPORE_ZOOM,
        }}
        maxBounds={SINGAPORE_BOUNDS}
        mapStyle={MAP_STYLE}
        cursor="grab"
        onClick={handleMapClick}
      >
        <NavigationControl position="bottom-right" />

        {restaurants.map((r) => {
          const { groupSize, groupKey, pixelOffset } = groupInfo[r.id]
          const isExpanded = spiderfiedKey === groupKey
          return (
            <PinMarker
              key={r.id}
              restaurant={r}
              isOwner={isOwner}
              editMode={editMode}
              isSelected={selectedRestaurant?.id === r.id}
              onClick={() => handlePinClick(r)}
              onRefresh={onRestaurantSaved}
              onEdit={() => {
                setSelectedRestaurant(null)
                setEditRestaurant(r)
              }}
              pixelOffset={pixelOffset}
              stackCount={!isExpanded && groupSize > 1 ? groupSize : undefined}
            />
          )
        })}

      </Map>

      {/* Attribution */}
      <div
        className="absolute bottom-2 left-2 rounded px-1.5 py-0.5 pointer-events-none"
        style={{
          fontSize: 10,
          color: 'var(--fm-ink-3)',
          background: 'rgba(251,248,241,0.85)',
          fontFamily: 'var(--font-geist-mono)',
        }}
      >
        © CartoDB · OpenStreetMap
      </div>

      {addPinCoords && (
        <AddPinModal
          lng={addPinCoords.lng}
          lat={addPinCoords.lat}
          onClose={() => setAddPinCoords(null)}
          onSaved={() => {
            setAddPinCoords(null)
            onRestaurantSaved()
          }}
        />
      )}

      {editRestaurant && (
        <AddPinModal
          restaurant={editRestaurant}
          onClose={() => setEditRestaurant(null)}
          onSaved={() => {
            setEditRestaurant(null)
            onRestaurantSaved()
          }}
        />
      )}
    </div>
  )
}
