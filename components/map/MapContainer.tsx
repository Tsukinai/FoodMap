'use client'

import { useRef, useState, useEffect, useMemo } from 'react'
import Map, { NavigationControl, Marker, type MapRef } from 'react-map-gl/maplibre'
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
  const [userLocation, setUserLocation] = useState<{ lng: number; lat: number } | null>(null)
  const [locating, setLocating] = useState(false)

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

  function handleLocate() {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { longitude: lng, latitude: lat } = pos.coords
        setUserLocation({ lng, lat })
        setLocating(false)
        mapRef.current?.flyTo({ center: [lng, lat], zoom: 15, duration: 1200 })
      },
      () => setLocating(false),
      { timeout: 10000 }
    )
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

        {userLocation && (
          <Marker longitude={userLocation.lng} latitude={userLocation.lat} anchor="center">
            <div style={{ position: 'relative', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {/* Pulsing outer ring */}
              <div style={{
                position: 'absolute',
                width: 44, height: 44,
                borderRadius: '50%',
                background: 'rgba(59,130,246,0.18)',
                animation: 'ping 2s cubic-bezier(0,0,0.2,1) infinite',
              }} />
              {/* Soft halo */}
              <div style={{
                position: 'absolute',
                width: 26, height: 26,
                borderRadius: '50%',
                background: 'rgba(59,130,246,0.22)',
              }} />
              {/* Core dot */}
              <div style={{
                position: 'relative',
                width: 14, height: 14,
                borderRadius: '50%',
                background: '#3b82f6',
                border: '2.5px solid #fff',
                boxShadow: '0 2px 8px rgba(59,130,246,0.55)',
              }} />
            </div>
          </Marker>
        )}

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

      {/* Locate button */}
      <div style={{ position: 'absolute', bottom: 32, left: 8, zIndex: 10 }}>
        <button
          onClick={handleLocate}
          disabled={locating}
          style={{
            width: 32,
            height: 32,
            borderRadius: 6,
            border: '1px solid rgba(0,0,0,0.15)',
            background: locating ? 'var(--fm-cream)' : 'var(--fm-paper)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
            cursor: locating ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: userLocation ? '#3b82f6' : 'var(--fm-ink-2)',
            transition: 'color 0.2s, background 0.15s',
            position: 'relative',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v4M12 19v4M1 12h4M19 12h4" />
          </svg>
          {/* Tooltip */}
          <span className="locate-tooltip" style={{
            position: 'absolute',
            left: '110%',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'rgba(30,30,30,0.82)',
            color: '#fff',
            fontSize: 11,
            padding: '3px 7px',
            borderRadius: 4,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}>
            定位到我的位置
          </span>
        </button>
      </div>

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
