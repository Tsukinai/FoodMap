'use client'

import { useState } from 'react'
import { Marker, Popup } from 'react-map-gl/maplibre'
import type { Restaurant } from '@/lib/types'

interface Props {
  restaurant: Restaurant
  isOwner: boolean
  isSelected: boolean
  onClick: () => void
  onRefresh: () => void
}

export default function PinMarker({ restaurant, isOwner, isSelected, onClick, onRefresh }: Props) {
  const [deleting, setDeleting] = useState(false)

  const cuisineTags = restaurant.tags.filter((t) => t.type === 'cuisine')
  const dishTags = restaurant.tags.filter((t) => t.type === 'dish')
  const tasteTags = restaurant.tags.filter((t) => t.type === 'taste')
  const sceneTags = restaurant.tags.filter((t) => t.type === 'scene')

  const cost = restaurant.cost_min && restaurant.cost_max
    ? `S$ ${restaurant.cost_min}–${restaurant.cost_max}`
    : restaurant.cost_min
    ? `S$ ${restaurant.cost_min}+`
    : restaurant.cost_max
    ? `≤ S$ ${restaurant.cost_max}`
    : null

  async function handleDelete() {
    if (!confirm(`删除 "${restaurant.name}"？`)) return
    setDeleting(true)
    await fetch(`/api/restaurants/${restaurant.id}`, { method: 'DELETE' })
    onRefresh()
  }

  return (
    <>
      <Marker
        longitude={restaurant.location_lng}
        latitude={restaurant.location_lat}
        anchor="bottom"
        onClick={(e) => {
          e.originalEvent.stopPropagation()
          onClick()
        }}
      >
        <div
          className="cursor-pointer transition-transform hover:scale-110 relative"
          style={{ transform: isSelected ? 'scale(1.15)' : undefined }}
        >
          <svg
            width="18"
            height="24"
            viewBox="0 0 18 24"
            style={{ display: 'block', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.22))' }}
          >
            <path
              d="M9 0C4.029 0 0 4.029 0 9c0 6.75 9 15 9 15s9-8.25 9-15C18 4.029 13.971 0 9 0z"
              fill={isSelected ? '#a43d1f' : '#d96b2c'}
              stroke="#7a2e16"
              strokeWidth="0.8"
            />
            <circle cx="9" cy="9" r="3" fill="#fbf8f1" />
          </svg>
        </div>
      </Marker>

      {isSelected && (
        <Popup
          longitude={restaurant.location_lng}
          latitude={restaurant.location_lat}
          anchor="bottom"
          offset={30}
          closeButton={false}
          onClose={onClick}
          maxWidth="360px"
          className="foodmap-popup"
        >
          <div
            style={{
              background: 'var(--fm-paper)',
              fontFamily: 'var(--font-geist-sans)',
              color: 'var(--fm-ink)',
              width: 340,
              borderRadius: 12,
              overflow: 'hidden',
              boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
            }}
          >
            {/* Photo placeholder */}
            <div
              className="relative"
              style={{
                height: 96,
                background: 'repeating-linear-gradient(45deg, #e6ddc6 0 6px, #dcd3bc 6px 12px)',
              }}
            >
              <button
                onClick={onClick}
                className="absolute top-2 right-2 flex items-center justify-center rounded-full"
                style={{
                  width: 26,
                  height: 26,
                  background: 'rgba(251,248,241,0.9)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  color: 'var(--fm-ink-3)',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {/* Card body */}
            <div style={{ padding: '12px 14px 14px' }}>
              {/* Name */}
              <div
                style={{
                  fontFamily: 'var(--font-instrument-serif)',
                  fontSize: 22,
                  lineHeight: 1.1,
                  marginBottom: 2,
                }}
              >
                {restaurant.name}
              </div>

              {/* Address */}
              {restaurant.address && (
                <div
                  style={{
                    fontFamily: 'var(--font-geist-mono)',
                    fontSize: '1rem',
                    color: 'var(--fm-ink-3)',
                    marginBottom: 8,
                  }}
                >
                  {restaurant.address}
                  {restaurant.postal_code ? ` · ${restaurant.postal_code}` : ''}
                </div>
              )}

              {/* Cost */}
              {cost && (
                <div
                  style={{
                    fontFamily: 'var(--font-geist-mono)',
                    fontSize: '1rem',
                    color: 'var(--fm-ink-2)',
                    marginBottom: 10,
                  }}
                >
                  {cost} / 人
                </div>
              )}

              {/* Tags */}
              {(cuisineTags.length > 0 || dishTags.length > 0 || tasteTags.length > 0 || sceneTags.length > 0) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                  {cuisineTags.map((t) => (
                    <span key={t.id} className="fm-tag fm-tag-cuisine">{t.name}</span>
                  ))}
                  {dishTags.map((t) => (
                    <span key={t.id} className="fm-tag fm-tag-dish">{t.name}</span>
                  ))}
                  {tasteTags.map((t) => (
                    <span key={t.id} className="fm-tag fm-tag-taste">{t.name}</span>
                  ))}
                  {sceneTags.map((t) => (
                    <span key={t.id} className="fm-tag fm-tag-scene">{t.name}</span>
                  ))}
                </div>
              )}

              {/* Notes */}
              {restaurant.notes && (
                <p
                  style={{
                    fontSize: '1rem',
                    color: 'var(--fm-ink-2)',
                    lineHeight: 1.55,
                    fontStyle: 'italic',
                    marginBottom: 10,
                  }}
                >
                  {restaurant.notes}
                </p>
              )}

              {/* Divider */}
              <div style={{ height: 1, background: 'var(--fm-line)', marginBottom: 10 }} />

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8 }}>
                {isOwner && (
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    style={{
                      fontSize: '1rem',
                      fontFamily: 'var(--font-geist-sans)',
                      border: '1px solid var(--fm-line-2)',
                      background: 'transparent',
                      color: deleting ? 'var(--fm-ink-4)' : '#a43d1f',
                      cursor: deleting ? 'default' : 'pointer',
                      borderRadius: 6,
                      padding: '7px 12px',
                    }}
                  >
                    {deleting ? '删除中…' : '删除'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </Popup>
      )}
    </>
  )
}
