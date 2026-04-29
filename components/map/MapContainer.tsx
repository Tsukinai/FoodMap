'use client'

import { useRef, useState, useCallback } from 'react'
import Map, { Marker, NavigationControl, type MapRef } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { SINGAPORE_CENTER, SINGAPORE_ZOOM, SINGAPORE_BOUNDS } from '@/lib/constants'
import type { Restaurant, FilterPayload } from '@/lib/types'
import PinMarker from './PinMarker'
import AddPinModal from './AddPinModal'

const ONEMAP_STYLE = {
  version: 8 as const,
  sources: {
    onemap: {
      type: 'raster' as const,
      tiles: [
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [{ id: 'onemap-layer', type: 'raster' as const, source: 'onemap' }],
}

interface Props {
  restaurants: Restaurant[]
  isOwner: boolean
  filters: FilterPayload
  onRestaurantSaved: () => void
}

export default function MapContainer({ restaurants, isOwner, filters, onRestaurantSaved }: Props) {
  const mapRef = useRef<MapRef>(null)
  const [addPinCoords, setAddPinCoords] = useState<{ lng: number; lat: number } | null>(null)
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null)
  const [addingPin, setAddingPin] = useState(false)

  const handleMapClick = useCallback(
    (e: maplibregl.MapMouseEvent) => {
      if (!isOwner || !addingPin) return
      setAddPinCoords({ lng: e.lngLat.lng, lat: e.lngLat.lat })
      setAddingPin(false)
    },
    [isOwner, addingPin]
  )

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
        mapStyle={ONEMAP_STYLE}
        onClick={handleMapClick}
        cursor={addingPin ? 'crosshair' : 'grab'}
      >
        <NavigationControl position="bottom-right" />

        {restaurants.map((r) => (
          <PinMarker
            key={r.id}
            restaurant={r}
            isOwner={isOwner}
            isSelected={selectedRestaurant?.id === r.id}
            onClick={() => setSelectedRestaurant(r.id === selectedRestaurant?.id ? null : r)}
            onRefresh={onRestaurantSaved}
          />
        ))}

        {addPinCoords && (
          <Marker longitude={addPinCoords.lng} latitude={addPinCoords.lat}>
            <div
              className="rounded-full border-2 border-white shadow-lg animate-pulse"
              style={{ width: 16, height: 16, background: 'var(--fm-orange)' }}
            />
          </Marker>
        )}
      </Map>

      {/* Top overlay bar */}
      <div
        className="absolute top-3 left-3 right-3 flex items-center gap-2 pointer-events-none"
        style={{ zIndex: 10 }}
      >
        {/* Add pin button (owner only) */}
        {isOwner && (
          <button
            onClick={() => setAddingPin((v) => !v)}
            className="pointer-events-auto flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-2 shadow-md transition-colors"
            style={{
              fontFamily: 'var(--font-geist-sans)',
              background: addingPin ? '#a43d1f' : 'var(--fm-orange)',
              color: '#fff',
              boxShadow: '0 4px 10px rgba(217,107,44,0.3)',
            }}
          >
            {addingPin ? '取消' : '＋ 打地图钉'}
          </button>
        )}

        <div className="flex-1" />

        {/* Pin legend */}
        <div
          className="pointer-events-auto flex items-center gap-3 rounded-lg px-3 py-1.5"
          style={{
            background: 'var(--fm-paper)',
            border: '1px solid var(--fm-line-2)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
            fontSize: 11,
            color: 'var(--fm-ink-2)',
            fontFamily: 'var(--font-geist-mono)',
          }}
        >
          <span className="flex items-center gap-1.5">
            <PinIcon filled /> 已记录
          </span>
        </div>
      </div>

      {/* Attribution */}
      <div
        className="absolute bottom-2 left-2 rounded px-1.5 py-0.5 pointer-events-none"
        style={{
          fontSize: 9,
          color: 'var(--fm-ink-3)',
          background: 'rgba(251,248,241,0.85)',
          fontFamily: 'var(--font-geist-mono)',
        }}
      >
        Map © OneMap | Singapore Land Authority
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
    </div>
  )
}

function PinIcon({ filled }: { filled?: boolean }) {
  return (
    <svg width="12" height="16" viewBox="0 0 18 24" fill="none">
      <path
        d="M9 0C4.029 0 0 4.029 0 9c0 6.75 9 15 9 15s9-8.25 9-15C18 4.029 13.971 0 9 0z"
        fill={filled ? 'var(--fm-orange)' : 'var(--fm-paper)'}
        stroke="var(--fm-orange-dark)"
        strokeWidth="1.2"
      />
      <circle cx="9" cy="9" r="3" fill={filled ? 'var(--fm-paper)' : 'var(--fm-orange)'} />
    </svg>
  )
}
