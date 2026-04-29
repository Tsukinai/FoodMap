'use client'

import { useRef, useState, useCallback } from 'react'
import Map, { Marker, NavigationControl, type MapRef } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { SINGAPORE_CENTER, SINGAPORE_ZOOM, SINGAPORE_BOUNDS } from '@/lib/constants'
import type { Restaurant, FilterPayload } from '@/lib/types'
import PinMarker from './PinMarker'
import AddPinModal from './AddPinModal'
import EditPinModal from './EditPinModal'

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
}

export default function MapContainer({
  restaurants,
  isOwner,
  filters,
  addingPin,
  onAddingPinChange,
  onRestaurantSaved,
}: Props) {
  const mapRef = useRef<MapRef>(null)
  const [addPinCoords, setAddPinCoords] = useState<{ lng: number; lat: number } | null>(null)
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null)
  const [editRestaurant, setEditRestaurant] = useState<Restaurant | null>(null)

  const handleMapClick = useCallback(
    (e: maplibregl.MapMouseEvent) => {
      if (!isOwner || !addingPin) return
      setAddPinCoords({ lng: e.lngLat.lng, lat: e.lngLat.lat })
      onAddingPinChange(false)
    },
    [isOwner, addingPin, onAddingPinChange],
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
        mapStyle={MAP_STYLE}
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
            onEdit={() => {
              setSelectedRestaurant(null)
              setEditRestaurant(r)
            }}
          />
        ))}

        {addPinCoords && (
          <Marker longitude={addPinCoords.lng} latitude={addPinCoords.lat}>
            <div
              className="rounded-full border-2 border-white shadow-lg animate-pulse"
              style={{ width: 20, height: 20, background: 'var(--fm-orange)' }}
            />
          </Marker>
        )}
      </Map>

      {/* Top-right owner controls */}
      {isOwner && (
        <div
          className="absolute top-3 right-3 flex items-center gap-2"
          style={{ zIndex: 10 }}
        >
          <button
            onClick={() => onAddingPinChange(!addingPin)}
            className="flex items-center gap-1.5 text-sm font-medium rounded-xl px-4 py-2 shadow-md transition-colors"
            style={{
              fontFamily: 'var(--font-geist-sans)',
              background: addingPin ? '#a43d1f' : 'var(--fm-orange)',
              color: '#fff',
              boxShadow: '0 4px 10px rgba(217,107,44,0.3)',
            }}
          >
            {addingPin ? '取消' : '＋ 打地图钉'}
          </button>
        </div>
      )}

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
        <EditPinModal
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
