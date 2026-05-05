'use client'

import { useState } from 'react'
import { Marker, Popup } from 'react-map-gl/maplibre'
import type { Restaurant } from '@/lib/types'
import { CUISINE_COLORS, CUISINE_BG } from '@/lib/constants'
import { getRatingStyle } from '@/components/map/AddPinModal'

interface Props {
  restaurant: Restaurant
  isOwner: boolean
  editMode: boolean
  isSelected: boolean
  onClick: () => void
  onRefresh: () => void
  onEdit: () => void
  pixelOffset?: [number, number]
  stackCount?: number
}

export default function PinMarker({ restaurant, isOwner, editMode, isSelected, onClick, onRefresh, onEdit, pixelOffset, stackCount }: Props) {
  const [deleting, setDeleting] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const cuisineTags = restaurant.tags.filter((t) => t.type === 'cuisine')
  const dishTags    = restaurant.tags.filter((t) => t.type === 'dish')
  const tasteTags   = restaurant.tags.filter((t) => t.type === 'taste')
  const sceneTags   = restaurant.tags.filter((t) => t.type === 'scene')

  // Pick colour from first cuisine tag, fall back to orange
  const primaryCuisine = cuisineTags[0]?.name
  const pinColor  = CUISINE_COLORS[primaryCuisine ?? ''] ?? 'var(--fm-orange)'
  const pinBg     = CUISINE_BG[primaryCuisine ?? '']    ?? '#fdf0e6'

  const cost = restaurant.cost_min && restaurant.cost_max
    ? `S$ ${restaurant.cost_min}–${restaurant.cost_max}`
    : restaurant.cost_min
    ? `S$ ${restaurant.cost_min}+`
    : restaurant.cost_max
    ? `≤ S$ ${restaurant.cost_max}`
    : null

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/restaurants/${restaurant.id}`, { method: 'DELETE' })
      if (res.ok) {
        onRefresh()
      } else {
        setDeleting(false)
        setConfirmingDelete(false)
      }
    } catch {
      setDeleting(false)
      setConfirmingDelete(false)
    }
  }

  const [offsetX, offsetY] = pixelOffset ?? [0, 0]

  return (
    <>
      <Marker
        longitude={restaurant.location_lng}
        latitude={restaurant.location_lat}
        anchor="bottom"
        offset={[offsetX, offsetY]}
        onClick={(e) => {
          e.originalEvent.stopPropagation()
          onClick()
        }}
      >
        <div className="relative cursor-pointer">
        {stackCount && (
          <div
            style={{
              position: 'absolute',
              top: -5,
              right: -7,
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: 'var(--fm-ink)',
              color: 'var(--fm-paper)',
              fontSize: 9,
              fontFamily: 'var(--font-geist-mono)',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1,
              pointerEvents: 'none',
            }}
          >
            {stackCount}
          </div>
        )}
        <div
          className="transition-transform"
          style={{
            transform: isSelected ? 'scale(1.25) translateY(-2px)' : 'scale(1)',
            filter: isSelected
              ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.32))'
              : 'drop-shadow(0 2px 4px rgba(0,0,0,0.22))',
          }}
        >
          {restaurant.status === 'want' ? (
            <svg width="24" height="32" viewBox="0 0 24 32" fill="none">
              <path
                d="M12 0C5.373 0 0 5.373 0 12c0 9 12 20 12 20S24 21 24 12C24 5.373 18.627 0 12 0z"
                fill={isSelected ? '#1f1c18' : 'var(--fm-paper)'}
                stroke={isSelected ? '#1f1c18' : pinColor}
                strokeWidth="2"
              />
              <circle cx="12" cy="12" r="3.5" fill={isSelected ? 'white' : pinColor} fillOpacity="0.9" />
            </svg>
          ) : (
            <svg width="24" height="32" viewBox="0 0 24 32" fill="none">
              <path
                d="M12 0C5.373 0 0 5.373 0 12c0 9 12 20 12 20S24 21 24 12C24 5.373 18.627 0 12 0z"
                fill={isSelected ? '#1f1c18' : pinColor}
              />
              <circle cx="12" cy="12" r="5" fill="white" fillOpacity="0.92" />
            </svg>
          )}
        </div>
        </div>
      </Marker>

      {isSelected && (
        <Popup
          longitude={restaurant.location_lng}
          latitude={restaurant.location_lat}
          anchor="bottom"
          offset={[offsetX, offsetY - 36]}
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
              borderRadius: 14,
              overflow: 'hidden',
              boxShadow: '0 16px 40px rgba(0,0,0,0.14)',
            }}
          >
            {/* Colour header band */}
            <div
              style={{
                height: 80,
                background: `linear-gradient(135deg, ${pinColor}cc 0%, ${pinColor}88 100%)`,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Cuisine badge */}
              {primaryCuisine && (
                <span
                  style={{
                    padding: '4px 12px',
                    borderRadius: 99,
                    fontSize: 12,
                    fontWeight: 600,
                    background: 'rgba(255,255,255,0.88)',
                    color: pinColor,
                    fontFamily: 'var(--font-geist-mono)',
                  }}
                >
                  {primaryCuisine}
                </span>
              )}
              <button
                onClick={onClick}
                className="absolute top-2 right-2 flex items-center justify-center rounded-full"
                style={{
                  width: 26,
                  height: 26,
                  background: 'rgba(251,248,241,0.9)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 14,
                  color: 'var(--fm-ink-3)',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {/* Card body */}
            <div style={{ padding: '12px 14px 14px' }}>
              {/* Name + badges */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                <div
                  style={{
                    fontFamily: 'var(--font-instrument-serif)',
                    fontSize: 21,
                    lineHeight: 1.15,
                  }}
                >
                  {restaurant.name}
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: 'var(--font-geist-mono)',
                    fontWeight: 500,
                    padding: '2px 7px',
                    borderRadius: 99,
                    flexShrink: 0,
                    background: restaurant.status === 'want' ? '#fdf0e6' : '#eaf4ee',
                    color: restaurant.status === 'want' ? '#c8883a' : 'var(--fm-green)',
                    border: restaurant.status === 'want' ? '1px solid #e8c89a' : '1px solid #a8d4b4',
                  }}
                >
                  {restaurant.status === 'want' ? '想吃' : '已吃'}
                </span>
                {restaurant.rating && restaurant.rating !== '未评分' && (() => {
                  const { bg, color, border } = getRatingStyle(restaurant.rating)
                  return (
                    <span
                      style={{
                        fontSize: 11,
                        fontFamily: 'var(--font-geist-mono)',
                        fontWeight: 600,
                        padding: '2px 7px',
                        borderRadius: 99,
                        flexShrink: 0,
                        background: bg,
                        color,
                        border: `1px solid ${border}`,
                      }}
                    >
                      {restaurant.rating}
                    </span>
                  )
                })()}
              </div>

              {/* Address */}
              {restaurant.address && (
                <div
                  style={{
                    fontFamily: 'var(--font-geist-mono)',
                    fontSize: 11.5,
                    color: 'var(--fm-ink-3)',
                    marginBottom: 10,
                  }}
                >
                  📍 {restaurant.address}
                  {restaurant.postal_code ? ` · ${restaurant.postal_code}` : ''}
                </div>
              )}

              {/* Signature dishes */}
              {restaurant.signature_dishes?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                  {restaurant.signature_dishes.map((d) => (
                    <span
                      key={d}
                      style={{
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontSize: 11.5,
                        fontFamily: 'var(--font-geist-mono)',
                        background: 'var(--fm-cream)',
                        color: 'var(--fm-ink-2)',
                        border: '1px solid var(--fm-line)',
                      }}
                    >
                      {d}
                    </span>
                  ))}
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

              {/* Cost */}
              {cost && (
                <div
                  style={{
                    fontFamily: 'var(--font-geist-mono)',
                    fontSize: 12,
                    color: 'var(--fm-ink-2)',
                    marginBottom: 10,
                  }}
                >
                  {cost} <span style={{ color: 'var(--fm-ink-4)' }}>/ 人</span>
                </div>
              )}

              {/* Notes */}
              {restaurant.notes && (
                <p
                  style={{
                    fontSize: 12.5,
                    color: 'var(--fm-ink-2)',
                    lineHeight: 1.55,
                    fontStyle: 'italic',
                    background: 'var(--fm-cream)',
                    borderRadius: 8,
                    padding: '7px 10px',
                    marginBottom: 10,
                  }}
                >
                  "{restaurant.notes}"
                </p>
              )}

              {/* Divider + actions */}
              {isOwner && editMode && (
                <>
                  <div style={{ height: 1, background: 'var(--fm-line)', marginBottom: 10 }} />
                  {confirmingDelete ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ fontSize: 12.5, color: '#a43d1f', fontFamily: 'var(--font-geist-sans)', flex: 1 }}>
                        确认删除？
                      </span>
                      <button
                        onClick={handleDelete}
                        disabled={deleting}
                        style={{
                          fontSize: 12.5,
                          fontFamily: 'var(--font-geist-sans)',
                          border: 'none',
                          background: '#a43d1f',
                          color: '#fff',
                          cursor: deleting ? 'default' : 'pointer',
                          borderRadius: 8,
                          padding: '7px 12px',
                          fontWeight: 500,
                          opacity: deleting ? 0.6 : 1,
                        }}
                      >
                        {deleting ? '删除中…' : '确认'}
                      </button>
                      <button
                        onClick={() => setConfirmingDelete(false)}
                        disabled={deleting}
                        style={{
                          fontSize: 12.5,
                          fontFamily: 'var(--font-geist-sans)',
                          border: '1.5px solid var(--fm-line-2)',
                          background: 'transparent',
                          color: 'var(--fm-ink-2)',
                          cursor: 'pointer',
                          borderRadius: 8,
                          padding: '7px 12px',
                          fontWeight: 500,
                        }}
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 7 }}>
                      <button
                        onClick={onEdit}
                        style={{
                          fontSize: 12.5,
                          fontFamily: 'var(--font-geist-sans)',
                          border: '1.5px solid var(--fm-line-2)',
                          background: 'transparent',
                          color: 'var(--fm-ink-2)',
                          cursor: 'pointer',
                          borderRadius: 8,
                          padding: '7px 12px',
                          fontWeight: 500,
                          transition: 'border-color 0.12s',
                        }}
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => setConfirmingDelete(true)}
                        style={{
                          fontSize: 12.5,
                          fontFamily: 'var(--font-geist-sans)',
                          border: '1.5px solid var(--fm-line-2)',
                          background: 'transparent',
                          color: '#a43d1f',
                          cursor: 'pointer',
                          borderRadius: 8,
                          padding: '7px 12px',
                          fontWeight: 500,
                        }}
                      >
                        删除
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </Popup>
      )}
    </>
  )
}
