'use client'

import { useState, useEffect, useMemo } from 'react'
import type { Restaurant } from '@/lib/types'
import { CUISINE_STYLES } from '@/lib/constants'
import { formatCostRange } from '@/lib/utils'
import { getRatingStyle } from '@/components/map/AddPinModal'
import AddPinModal from '@/components/map/AddPinModal'

const PAGE_SIZE_OPTIONS = [5, 10, 20]

interface Props {
  restaurants: Restaurant[]
  loading?: boolean
  isOwner?: boolean
  onSaved?: () => void
}

const TAG_TYPE_STYLES: Record<string, { color: string; bg: string }> = {
  dish:  { color: '#6b635a', bg: '#f5f0e8' },
  taste: { color: '#a43d1f', bg: '#f0d9c4' },
  scene: { color: '#4a3d6b', bg: '#dcd6e6' },
}

function TagBadge({ name, type }: { name: string; type: string }) {
  const style = type === 'cuisine'
    ? { color: CUISINE_STYLES[name]?.color ?? '#6b635a', bg: CUISINE_STYLES[name]?.bg ?? '#f5f0e8' }
    : (TAG_TYPE_STYLES[type] ?? { color: '#6b635a', bg: '#f5f0e8' })
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 20,
        fontSize: 12,
        fontFamily: 'var(--font-geist-sans)',
        fontWeight: 500,
        color: style.color,
        background: style.bg,
        whiteSpace: 'nowrap',
      }}
    >
      {name}
    </span>
  )
}

const TAG_GROUPS: { type: string; label: string }[] = [
  { type: 'cuisine', label: '菜系' },
  { type: 'dish',    label: '种类' },
  { type: 'taste',   label: '口味' },
  { type: 'scene',   label: '场合' },
]

function CuisineAvatar({ tags }: { tags: Restaurant['tags'] }) {
  const cuisine = tags.find((t) => t.type === 'cuisine')
  const color = cuisine ? (CUISINE_STYLES[cuisine.name]?.color ?? '#6b635a') : '#a39a8d'
  const bg = cuisine ? (CUISINE_STYLES[cuisine.name]?.bg ?? '#f5f0e8') : '#f0ebe0'
  const emoji = getCuisineEmoji(cuisine?.name)
  return (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: 12,
        background: bg,
        border: `1.5px solid ${color}22`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 22,
        flexShrink: 0,
      }}
    >
      {emoji}
    </div>
  )
}

function getCuisineEmoji(cuisine?: string): string {
  const map: Record<string, string> = {
    '海南': '🍚', '娘惹': '🌶️', '潮州': '🥢', '粤式': '🦆', '粤菜': '🦆',
    '本地': '🇸🇬', '烧烤': '🔥', '西式': '🥩', '法式': '🥐', '日式': '🍣',
    '韩式': '🥩', '印度': '🍛', '马来': '🍜', '泰式': '🥭', '越南': '🍜',
    '海鲜': '🦞', '素食': '🥗', '中餐': '🥢', '东南亚菜': '🍜', '韩餐': '🥘',
    '日料': '🍱', '泰餐': '🥭', '西餐': '🍽️', '甜品': '🍰', '川菜': '🌶️',
    '云南菜': '🍄', '湘菜': '🌶️', '新疆菜': '🐑', '印度菜': '🍛', '马来菜': '🍜',
    '越南菜': '🍜', '本地菜': '🇸🇬',
    '东北菜': '🥟', '闽菜': '🦪', '南洋菜': '🍜',
    '意大利菜': '🍝', '法餐': '🥐', '瑞典菜': '🫙', '西班牙菜': '🥘',
    '小吃': '🍢', '酒吧': '🍺', '饮品': '🧋',
  }
  return map[cuisine ?? ''] ?? '🍴'
}

export default function RestaurantList({ restaurants, loading, isOwner, onSaved }: Props) {
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(5)
  const [editRestaurant, setEditRestaurant] = useState<Restaurant | null>(null)

  useEffect(() => { setPage(0) }, [restaurants, pageSize])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(restaurants.length / pageSize)), [restaurants.length, pageSize])
  const pageItems = useMemo(() => restaurants.slice(page * pageSize, (page + 1) * pageSize), [restaurants, page, pageSize])

  const btnBase: React.CSSProperties = {
    fontFamily: 'var(--font-geist-mono)',
    fontSize: 12,
    borderRadius: 6,
    border: '1px solid var(--fm-line)',
    background: 'var(--fm-paper)',
    color: 'var(--fm-ink-2)',
    padding: '2px 7px',
    cursor: 'pointer',
    lineHeight: '18px',
  }

  const header = (
    <div
      style={{
        flexShrink: 0,
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        borderBottom: '1px solid var(--fm-line)',
        background: 'var(--fm-cream)',
      }}
    >
      <h2
        style={{
          fontFamily: 'var(--font-instrument-serif)',
          fontSize: 19,
          color: 'var(--fm-ink)',
          margin: 0,
          flexShrink: 0,
        }}
      >
        全部餐厅
      </h2>

      <div style={{ flex: 1 }} />

      {/* Page size */}
      <div style={{ display: 'flex', gap: 2 }}>
        {PAGE_SIZE_OPTIONS.map((n) => (
          <button
            key={n}
            onClick={() => setPageSize(n)}
            style={{
              ...btnBase,
              background: pageSize === n ? 'var(--fm-ink)' : 'var(--fm-paper)',
              color: pageSize === n ? 'var(--fm-cream)' : 'var(--fm-ink-3)',
              borderColor: pageSize === n ? 'var(--fm-ink)' : 'var(--fm-line)',
            }}
          >
            {n}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 14, background: 'var(--fm-line-2)', flexShrink: 0 }} />

      {/* Prev */}
      <button
        onClick={() => setPage((p) => Math.max(0, p - 1))}
        disabled={page === 0 || restaurants.length === 0}
        style={{
          ...btnBase,
          padding: '2px 8px',
          color: page === 0 ? 'var(--fm-ink-4)' : 'var(--fm-ink-2)',
          cursor: page === 0 ? 'default' : 'pointer',
        }}
      >
        ←
      </button>

      {/* Page indicator */}
      <span
        style={{
          fontSize: 12,
          fontFamily: 'var(--font-geist-mono)',
          color: 'var(--fm-ink-3)',
          minWidth: 36,
          textAlign: 'center',
        }}
      >
        {restaurants.length === 0 ? '—' : `${page + 1}/${totalPages}`}
      </span>

      {/* Next */}
      <button
        onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
        disabled={page >= totalPages - 1 || restaurants.length === 0}
        style={{
          ...btnBase,
          padding: '2px 8px',
          color: page >= totalPages - 1 ? 'var(--fm-ink-4)' : 'var(--fm-ink-2)',
          cursor: page >= totalPages - 1 ? 'default' : 'pointer',
        }}
      >
        →
      </button>

      {/* Divider */}
      <div style={{ width: 1, height: 14, background: 'var(--fm-line-2)', flexShrink: 0 }} />

      {/* Count */}
      <span
        style={{
          fontSize: 12,
          fontFamily: 'var(--font-geist-mono)',
          color: 'var(--fm-ink-3)',
          flexShrink: 0,
        }}
      >
        {restaurants.length} 家
      </span>
    </div>
  )

  const outerStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--fm-cream)',
  }

  if (loading) {
    return (
      <div style={outerStyle}>
        {header}
        <div className="flex-1 flex items-center justify-center text-sm" style={{ color: 'var(--fm-ink-3)', fontFamily: 'var(--font-geist-mono)' }}>
          加载中…
        </div>
      </div>
    )
  }

  if (restaurants.length === 0) {
    return (
      <div style={outerStyle}>
        {header}
        <div className="flex-1 flex flex-col items-center justify-center gap-2" style={{ color: 'var(--fm-ink-3)', fontFamily: 'var(--font-geist-sans)' }}>
          <span style={{ fontSize: 32 }}>🍽️</span>
          <span style={{ fontSize: 14 }}>没有找到符合条件的餐厅</span>
        </div>
      </div>
    )
  }

  return (
    <div style={outerStyle}>
      {header}

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
        {pageItems.map((r) => (
          <RestaurantCard
            key={r.id}
            restaurant={r}
            isOwner={isOwner}
            onClick={isOwner ? () => setEditRestaurant(r) : undefined}
          />
        ))}
      </div>

      {editRestaurant && (
        <AddPinModal
          restaurant={editRestaurant}
          onClose={() => setEditRestaurant(null)}
          onSaved={() => {
            setEditRestaurant(null)
            onSaved?.()
          }}
          onDelete={() => {
            setEditRestaurant(null)
            onSaved?.()
          }}
        />
      )}
    </div>
  )
}

function RestaurantCard({
  restaurant: r,
  isOwner,
  onClick,
}: {
  restaurant: Restaurant
  isOwner?: boolean
  onClick?: () => void
}) {
  const tagGroups = TAG_GROUPS
    .map(({ type, label }) => ({ type, label, tags: r.tags.filter((t) => t.type === type) }))
    .filter((g) => g.tags.length > 0)

  const costBase = formatCostRange(r.cost_min, r.cost_max)
  const priceLabel = costBase ? `${costBase} / 人` : null

  return (
    <div
      className="fm-list-card"
      style={{
        background: 'var(--fm-paper)',
        borderRadius: 14,
        border: '1px solid var(--fm-line)',
        padding: '14px 16px',
        display: 'flex',
        gap: 12,
        cursor: isOwner ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s ease',
      }}
      onClick={onClick}
    >
      <CuisineAvatar tags={r.tags} />

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Name row */}
        <div className="flex items-start justify-between gap-2">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
            <span
              style={{
                fontFamily: 'var(--font-geist-sans)',
                fontWeight: 600,
                fontSize: 15,
                color: 'var(--fm-ink)',
                lineHeight: 1.3,
              }}
            >
              {r.name}
            </span>
            {r.rating && r.rating !== '未评分' && (() => {
              const { bg, color, border } = getRatingStyle(r.rating)
              return (
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: 'var(--font-geist-mono)',
                    fontWeight: 600,
                    padding: '1px 6px',
                    borderRadius: 99,
                    flexShrink: 0,
                    background: bg,
                    color,
                    border: `1px solid ${border}`,
                  }}
                >
                  {r.rating}
                </span>
              )
            })()}
          </div>
          {priceLabel && (
            <span
              style={{
                fontSize: 12,
                fontFamily: 'var(--font-geist-mono)',
                color: 'var(--fm-ink-3)',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                paddingTop: 2,
              }}
            >
              {priceLabel}
            </span>
          )}
        </div>

        {/* Address */}
        {r.address && (
          <div
            style={{
              fontSize: 12,
              fontFamily: 'var(--font-geist-sans)',
              color: 'var(--fm-ink-3)',
              marginTop: 3,
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="var(--fm-orange)" style={{ flexShrink: 0 }}>
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            <span className="truncate">{r.address}</span>
          </div>
        )}

        {/* Tags */}
        {tagGroups.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 7, alignItems: 'center' }}>
            {tagGroups.flatMap(({ type, label, tags }, i) => [
              ...(i > 0 ? [
                <span key={`sep-${type}`} style={{ fontSize: 12, color: 'var(--fm-ink-4)', lineHeight: 1 }}>·</span>
              ] : []),
              <span key={`label-${type}`} style={{ fontSize: 10, fontFamily: 'var(--font-geist-mono)', color: 'var(--fm-ink-4)' }}>
                {label}
              </span>,
              ...tags.map((t) => <TagBadge key={t.id} name={t.name} type={t.type} />),
            ])}
          </div>
        )}

        {/* Notes */}
        {r.notes && (
          <p
            style={{
              margin: '7px 0 0',
              fontSize: 12,
              fontFamily: 'var(--font-geist-sans)',
              color: 'var(--fm-ink-3)',
              lineHeight: 1.6,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {r.notes}
          </p>
        )}
      </div>
    </div>
  )
}
