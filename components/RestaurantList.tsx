'use client'

import type { Restaurant } from '@/lib/types'
import { CUISINE_COLORS, CUISINE_BG } from '@/lib/constants'

interface Props {
  restaurants: Restaurant[]
  loading?: boolean
}

function TagBadge({ name, type }: { name: string; type: string }) {
  const color = type === 'cuisine' ? (CUISINE_COLORS[name] ?? '#6b635a') : '#6b635a'
  const bg = type === 'cuisine' ? (CUISINE_BG[name] ?? '#f5f0e8') : '#f5f0e8'
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
        color,
        background: bg,
        whiteSpace: 'nowrap',
      }}
    >
      {name}
    </span>
  )
}

function CuisineAvatar({ tags }: { tags: Restaurant['tags'] }) {
  const cuisine = tags.find((t) => t.type === 'cuisine')
  const color = cuisine ? (CUISINE_COLORS[cuisine.name] ?? '#6b635a') : '#a39a8d'
  const bg = cuisine ? (CUISINE_BG[cuisine.name] ?? '#f5f0e8') : '#f0ebe0'
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
  }
  return map[cuisine ?? ''] ?? '🍴'
}

export default function RestaurantList({ restaurants, loading }: Props) {
  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-full text-sm"
        style={{ color: 'var(--fm-ink-3)', fontFamily: 'var(--font-geist-mono)' }}
      >
        加载中…
      </div>
    )
  }

  if (restaurants.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full gap-2"
        style={{ color: 'var(--fm-ink-3)', fontFamily: 'var(--font-geist-sans)' }}
      >
        <span style={{ fontSize: 32 }}>🍽️</span>
        <span style={{ fontSize: 14 }}>没有找到符合条件的餐厅</span>
      </div>
    )
  }

  return (
    <div
      className="h-full overflow-y-auto"
      style={{ background: 'var(--fm-cream)' }}
    >
      {/* Header */}
      <div
        className="sticky top-0 px-6 py-3 flex items-center justify-between"
        style={{
          background: 'var(--fm-cream)',
          borderBottom: '1px solid var(--fm-line)',
          zIndex: 1,
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-instrument-serif)',
            fontSize: 20,
            color: 'var(--fm-ink)',
            margin: 0,
          }}
        >
          全部餐厅
        </h2>
        <span
          style={{
            fontSize: 13,
            fontFamily: 'var(--font-geist-mono)',
            color: 'var(--fm-ink-3)',
          }}
        >
          {restaurants.length} 家
        </span>
      </div>

      {/* List */}
      <div className="px-4 py-3 flex flex-col gap-2">
        {restaurants.map((r) => (
          <RestaurantCard key={r.id} restaurant={r} />
        ))}
      </div>
    </div>
  )
}

function RestaurantCard({ restaurant: r }: { restaurant: Restaurant }) {
  const cuisineTags = r.tags.filter((t) => t.type === 'cuisine')
  const otherTags = r.tags.filter((t) => t.type !== 'cuisine')
  const displayTags = [...cuisineTags, ...otherTags].slice(0, 4)

  const priceLabel =
    r.cost_min !== null && r.cost_max !== null
      ? `S$${r.cost_min}–${r.cost_max} / 人`
      : r.cost_min !== null
        ? `S$${r.cost_min}+ / 人`
        : r.cost_max !== null
          ? `≤ S$${r.cost_max} / 人`
          : null

  return (
    <div
      style={{
        background: 'var(--fm-paper)',
        borderRadius: 14,
        border: '1px solid var(--fm-line)',
        padding: '14px 16px',
        display: 'flex',
        gap: 12,
        cursor: 'default',
        transition: 'box-shadow 0.15s ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.10)'
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
      }}
    >
      <CuisineAvatar tags={r.tags} />

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Name row */}
        <div className="flex items-start justify-between gap-2">
          <div
            style={{
              fontFamily: 'var(--font-geist-sans)',
              fontWeight: 600,
              fontSize: 15,
              color: 'var(--fm-ink)',
              lineHeight: 1.3,
            }}
          >
            {r.name}
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
        {displayTags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 7 }}>
            {displayTags.map((t) => (
              <TagBadge key={t.id} name={t.name} type={t.type} />
            ))}
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
