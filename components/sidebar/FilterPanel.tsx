'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { Tag, FilterPayload, RestaurantStatus, RestaurantRating } from '@/lib/types'
import { RATING_ORDER } from '@/lib/types'
import { getRatingStyle } from '@/components/map/AddPinModal'
import { CUISINE_STYLES, SINGAPORE_REGION_GROUPS } from '@/lib/constants'
import type { User } from '@supabase/supabase-js'
import { signIn, signOut } from '@/lib/auth'

interface Props {
  allTags: Tag[]
  filters: FilterPayload
  onChange: (filters: FilterPayload) => void
  restaurantCount: number
  user: User | null
  isOwner: boolean
  searchQuery?: string
  onSearchChange?: (q: string) => void
  availableAreas?: string[]
  viewMode?: 'map' | 'list' | 'guestbook'
  onViewModeChange?: (mode: 'map' | 'list' | 'guestbook') => void
  showViewToggle?: boolean
}

export default function FilterPanel({
  allTags,
  filters,
  onChange,
  restaurantCount,
  user,
  isOwner,
  searchQuery = '',
  onSearchChange,
  availableAreas = [],
  viewMode = 'map',
  onViewModeChange,
  showViewToggle = false,
}: Props) {
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set())
  const [areaExpanded, setAreaExpanded] = useState(false)

  function toggleExpand(id: string) {
    setExpandedParents(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Tag helpers ──────────────────────────────────────────────────────────
  const cuisineTopLevel = useMemo(() => allTags.filter((t) => t.type === 'cuisine' && !t.parent_id), [allTags])
  const cuisineSub      = useMemo(() => allTags.filter((t) => t.type === 'cuisine' && !!t.parent_id), [allTags])
  const childrenByParent = useMemo(() => {
    const map = new Map<string, Tag[]>()
    cuisineSub.forEach(tag => {
      if (!tag.parent_id) return
      const list = map.get(tag.parent_id) ?? []
      list.push(tag)
      map.set(tag.parent_id, list)
    })
    return map
  }, [cuisineSub])
  const dishTags  = useMemo(() => allTags.filter((t) => t.type === 'dish'),  [allTags])
  const tasteTags = useMemo(() => allTags.filter((t) => t.type === 'taste'), [allTags])
  const sceneTags = useMemo(() => allTags.filter((t) => t.type === 'scene'), [allTags])

  // ── Toggle helpers ───────────────────────────────────────────────────────
  function toggleArr(key: keyof FilterPayload, name: string) {
    const arr = (filters[key] as string[]) ?? []
    onChange({ ...filters, [key]: arr.includes(name) ? arr.filter((n) => n !== name) : [...arr, name] })
  }

  function handleCostMin(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value === '' ? null : Math.max(0, Number(e.target.value))
    onChange({ ...filters, min_cost: v })
  }

  function handleCostMax(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value === '' ? null : Number(e.target.value)
    onChange({ ...filters, max_cost: v })
  }

  function toggleStatus(s: RestaurantStatus) {
    const current = filters.status ?? []
    const next = current.includes(s) ? current.filter((v) => v !== s) : [...current, s]
    onChange({ ...filters, status: next })
  }

  function toggleRating(r: RestaurantRating) {
    const current = filters.ratings ?? []
    const next = current.includes(r) ? current.filter((v) => v !== r) : [...current, r]
    onChange({ ...filters, ratings: next })
  }

  function clearAll() {
    onChange({
      cuisine_tags: [],
      dish_tags:    [],
      taste_tags:   [],
      scene_tags:   [],
      max_cost:     null,
      min_cost:     null,
      status:       [],
      ratings:      [],
      areas:        [],
    })
  }

  const hasFilters =
    filters.cuisine_tags.length > 0 ||
    filters.dish_tags.length > 0 ||
    (filters.taste_tags?.length ?? 0) > 0 ||
    (filters.scene_tags?.length ?? 0) > 0 ||
    filters.max_cost !== null ||
    filters.min_cost !== null ||
    (filters.status?.length ?? 0) > 0 ||
    (filters.ratings?.length ?? 0) > 0 ||
    (filters.areas?.length ?? 0) > 0

  // ── Shared input style ───────────────────────────────────────────────────
  const costInputStyle: React.CSSProperties = {
    flex: 1,
    background: 'var(--fm-cream)',
    border: '1.5px solid var(--fm-line-2)',
    borderRadius: 8,
    padding: '7px 10px',
    fontSize: 13,
    fontFamily: 'var(--font-geist-mono)',
    color: 'var(--fm-ink)',
    outline: 'none',
    textAlign: 'center' as const,
    minWidth: 0,
  }

  return (
    <aside
      className="h-full flex flex-col border-r overflow-hidden"
      style={{
        width: 292,
        background: 'var(--fm-paper)',
        borderColor: 'var(--fm-line)',
        color: 'var(--fm-ink)',
      }}
    >
      {/* ── View toggle (mobile only) ── */}
      {showViewToggle && onViewModeChange && (
        <div style={{ padding: '10px 12px 0', borderBottom: '1px solid var(--fm-line)' }}>
          <div
            style={{
              display: 'flex',
              background: 'var(--fm-cream)',
              borderRadius: 10,
              padding: 3,
              gap: 2,
              marginBottom: 10,
            }}
          >
            {(['map', 'list', 'guestbook'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => onViewModeChange(mode)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  height: 32,
                  borderRadius: 7,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontFamily: 'var(--font-geist-sans)',
                  fontWeight: viewMode === mode ? 600 : 400,
                  background: viewMode === mode ? 'var(--fm-paper)' : 'transparent',
                  color: viewMode === mode ? 'var(--fm-ink)' : 'var(--fm-ink-3)',
                  boxShadow: viewMode === mode ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {mode === 'map' ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
                    <line x1="9" y1="3" x2="9" y2="18"/>
                    <line x1="15" y1="6" x2="15" y2="21"/>
                  </svg>
                ) : mode === 'list' ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6"/>
                    <line x1="8" y1="12" x2="21" y2="12"/>
                    <line x1="8" y1="18" x2="21" y2="18"/>
                    <line x1="3" y1="6" x2="3.01" y2="6"/>
                    <line x1="3" y1="12" x2="3.01" y2="12"/>
                    <line x1="3" y1="18" x2="3.01" y2="18"/>
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                )}
                {mode === 'map' ? '地图' : mode === 'list' ? '列表' : '留言'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Scrollable filter body ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Search ── */}
        <div style={{ position: 'relative' }}>
          <svg
            width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fm-ink-4)', pointerEvents: 'none' }}
          >
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="搜索餐厅名称…"
            value={searchQuery}
            onChange={e => onSearchChange?.(e.target.value)}
            style={{
              width: '100%',
              paddingLeft: 30,
              paddingRight: searchQuery ? 28 : 10,
              paddingTop: 8,
              paddingBottom: 8,
              borderRadius: 8,
              border: '1.5px solid var(--fm-line-2)',
              background: 'var(--fm-cream)',
              fontSize: 13,
              fontFamily: 'var(--font-geist-sans)',
              color: 'var(--fm-ink)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange?.('')}
              style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--fm-ink-4)', fontSize: 14, lineHeight: 1, padding: 0,
              }}
            >
              ×
            </button>
          )}
        </div>

        {/* ── 区域 ── */}
        {availableAreas.length > 0 && (
          <section>
            <button
              onClick={() => setAreaExpanded(v => !v)}
              style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                marginBottom: areaExpanded ? 8 : 0,
                gap: 6,
                fontFamily: 'var(--font-geist-mono)',
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--fm-ink-4)',
              }}
            >
              <span style={{ flex: 1, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6 }}>
                区域
                {(filters.areas?.length ?? 0) > 0 && (
                  <span className="fm-filter-label-count">{filters.areas?.length}</span>
                )}
              </span>
              <svg
                width="10" height="10" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: areaExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}
              >
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
            {areaExpanded && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {SINGAPORE_REGION_GROUPS.map(({ label, areas }) => {
                  const regionAreas = areas.filter(a => availableAreas.includes(a))
                  if (regionAreas.length === 0) return null
                  const selected = filters.areas ?? []
                  const allSel = regionAreas.every(a => selected.includes(a))
                  const someSel = !allSel && regionAreas.some(a => selected.includes(a))
                  return (
                    <div key={label}>
                      <button
                        onClick={() => {
                          const cur = filters.areas ?? []
                          const next = allSel
                            ? cur.filter(a => !regionAreas.includes(a))
                            : [...new Set([...cur, ...regionAreas])]
                          onChange({ ...filters, areas: next })
                        }}
                        style={{
                          padding: '2px 8px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          fontFamily: 'var(--font-geist-mono)',
                          letterSpacing: '0.05em',
                          marginBottom: 5,
                          background: allSel ? 'var(--fm-ink)' : someSel ? 'var(--fm-cream)' : 'var(--fm-muted)',
                          color: allSel ? 'var(--fm-paper)' : 'var(--fm-ink-2)',
                          border: allSel
                            ? '1.5px solid var(--fm-ink)'
                            : someSel
                            ? '1.5px solid var(--fm-ink-3)'
                            : '1.5px solid var(--fm-line-2)',
                          cursor: 'pointer',
                          transition: 'all 0.12s',
                          display: 'block',
                        }}
                      >
                        {label}
                      </button>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingLeft: 4 }}>
                        {regionAreas.map(area => {
                          const active = selected.includes(area)
                          return (
                            <button
                              key={area}
                              onClick={() => toggleArr('areas', area)}
                              className={`fm-chip${active ? ' active' : ''}`}
                              style={{ fontSize: 11 }}
                            >
                              {area}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {/* ── Status ── */}
        <section>
          <FilterLabel count={filters.status?.length ?? 0}>状态</FilterLabel>
          <div style={{ display: 'flex', gap: 6 }}>
            {([['want', '想吃'], ['visited', '已吃']] as [RestaurantStatus, string][]).map(([val, label]) => {
              const active = (filters.status ?? []).includes(val)
              return (
                <button
                  key={val}
                  onClick={() => toggleStatus(val)}
                  style={{
                    flex: 1,
                    padding: '7px 0',
                    borderRadius: 8,
                    fontSize: 12.5,
                    fontWeight: 500,
                    fontFamily: 'var(--font-geist-sans)',
                    border: active
                      ? val === 'want' ? '1.5px solid #c8883a' : '1.5px solid var(--fm-green)'
                      : '1.5px solid var(--fm-line-2)',
                    background: active
                      ? val === 'want' ? '#fdf0e6' : '#eaf4ee'
                      : 'var(--fm-muted)',
                    color: active
                      ? val === 'want' ? '#c8883a' : 'var(--fm-green)'
                      : 'var(--fm-ink-3)',
                    cursor: 'pointer',
                    transition: 'all 0.12s',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </section>

        {/* ── Cuisine ── */}
        <section>
          <FilterLabel count={filters.cuisine_tags.length}>菜系</FilterLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {cuisineTopLevel.map((tag) => {
                const children = childrenByParent.get(tag.id) ?? []
                const isExpanded = expandedParents.has(tag.id)
                const active = filters.cuisine_tags.includes(tag.name)
                const { color: fg, bg } = CUISINE_STYLES[tag.name] ?? { color: 'var(--fm-ink-2)', bg: 'var(--fm-muted)' }
                return (
                  <div key={tag.id} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <button
                      onClick={() => toggleArr('cuisine_tags', tag.name)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 8,
                        fontSize: 12.5,
                        fontWeight: 500,
                        fontFamily: 'var(--font-geist-sans)',
                        background: active ? fg : bg,
                        color: active ? '#fff' : fg,
                        border: `1.5px solid ${active ? fg : 'transparent'}`,
                        cursor: 'pointer',
                        transition: 'all 0.12s',
                      }}
                    >
                      {tag.name}
                    </button>
                    {children.length > 0 && (
                      <button
                        onClick={() => toggleExpand(tag.id)}
                        title={isExpanded ? '收起' : '展开'}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 6,
                          border: '1.5px solid var(--fm-line-2)',
                          background: 'var(--fm-muted)',
                          cursor: 'pointer',
                          color: 'var(--fm-ink-2)',
                          fontSize: 11,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 0,
                          transition: 'transform 0.15s',
                          transform: isExpanded ? 'rotate(90deg)' : 'none',
                          flexShrink: 0,
                        }}
                      >
                        ▸
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Expanded sub-cuisine panels */}
            {cuisineTopLevel
              .filter(tag => expandedParents.has(tag.id) && (childrenByParent.get(tag.id)?.length ?? 0) > 0)
              .map(parent => {
                const parentFg = CUISINE_STYLES[parent.name]?.color ?? 'var(--fm-ink-2)'
                return (
                  <div
                    key={parent.id}
                    style={{
                      paddingLeft: 8,
                      borderLeft: `2px solid ${parentFg}`,
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 4,
                    }}
                  >
                    {childrenByParent.get(parent.id)!.map(child => {
                      const childActive = filters.cuisine_tags.includes(child.name)
                      const childFg = CUISINE_STYLES[child.name]?.color ?? parentFg
                      const childBg = CUISINE_STYLES[child.name]?.bg ?? 'var(--fm-muted)'
                      return (
                        <button
                          key={child.id}
                          onClick={() => toggleArr('cuisine_tags', child.name)}
                          style={{
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: 11.5,
                            fontWeight: 500,
                            fontFamily: 'var(--font-geist-sans)',
                            background: childActive ? childFg : childBg,
                            color: childActive ? '#fff' : childFg,
                            border: `1.5px solid ${childActive ? childFg : 'transparent'}`,
                            cursor: 'pointer',
                            transition: 'all 0.12s',
                          }}
                        >
                          {child.name}
                        </button>
                      )
                    })}
                  </div>
                )
              })
            }
          </div>
        </section>

        {/* ── Dish type (种类) ── */}
        <section>
          <FilterLabel count={filters.dish_tags.length}>种类</FilterLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {dishTags.map((tag) => {
              const active = filters.dish_tags.includes(tag.name)
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleArr('dish_tags', tag.name)}
                  className={`fm-chip${active ? ' active' : ''}`}
                  style={{ fontSize: 12 }}
                >
                  {tag.name}
                </button>
              )
            })}
          </div>
        </section>

        {/* ── Taste ── */}
        <section>
          <FilterLabel count={filters.taste_tags?.length ?? 0}>口味</FilterLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {tasteTags.map((tag) => {
              const active = (filters.taste_tags ?? []).includes(tag.name)
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleArr('taste_tags', tag.name)}
                  className={`fm-chip fm-chip-taste${active ? ' active' : ''}`}
                  style={{ fontSize: 12 }}
                >
                  {tag.name}
                </button>
              )
            })}
          </div>
        </section>

        {/* ── Scene ── */}
        <section>
          <FilterLabel count={filters.scene_tags?.length ?? 0}>场合</FilterLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {sceneTags.map((tag) => {
              const active = (filters.scene_tags ?? []).includes(tag.name)
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleArr('scene_tags', tag.name)}
                  className={`fm-chip fm-chip-scene${active ? ' active' : ''}`}
                  style={{ fontSize: 12 }}
                >
                  {tag.name}
                </button>
              )
            })}
          </div>
        </section>

        {/* ── Rating ── */}
        <section>
          <FilterLabel count={filters.ratings?.length ?? 0}>评分</FilterLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {RATING_ORDER.map((r) => {
              const active = (filters.ratings ?? []).includes(r)
              const { bg, color, border } = getRatingStyle(r)
              return (
                <button
                  key={r}
                  onClick={() => toggleRating(r)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 500,
                    fontFamily: 'var(--font-geist-sans)',
                    background: active ? bg : 'var(--fm-muted)',
                    color: active ? color : 'var(--fm-ink-3)',
                    border: active ? `1.5px solid ${border}` : '1.5px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.12s',
                  }}
                >
                  {r}
                </button>
              )
            })}
          </div>
        </section>

      </div>

      {/* ── Footer ── */}
      <div
        className="px-4 pt-3 pb-4 flex flex-col gap-2"
        style={{ borderTop: '1px dashed var(--fm-line-2)', fontFamily: 'var(--font-geist-mono)' }}
      >
        {/* Count + clear */}
        <div className="flex items-center justify-between" style={{ fontSize: 11.5, color: 'var(--fm-ink-3)' }}>
          <span>
            {restaurantCount} 个餐厅
            {hasFilters && <span style={{ color: 'var(--fm-orange)', marginLeft: 4 }}>（已筛选）</span>}
          </span>
          <div className="flex items-center gap-3">
            {isOwner && (
              <Link
                href="/tags"
                style={{ fontSize: 11.5, color: 'var(--fm-ink-4)', textDecoration: 'none' }}
              >
                管理标签
              </Link>
            )}
            {hasFilters && (
              <button
                onClick={clearAll}
                style={{ color: 'var(--fm-orange-dark)', cursor: 'pointer', fontSize: 11.5 }}
              >
                重置
              </button>
            )}
          </div>
        </div>

        {/* Auth */}
        {user ? (
          <div className="flex items-center gap-2">
            {user.user_metadata?.avatar_url ? (
              <img
                src={user.user_metadata.avatar_url}
                alt="avatar"
                referrerPolicy="no-referrer"
                className="rounded-full flex-shrink-0"
                style={{ width: 28, height: 28, objectFit: 'cover' }}
              />
            ) : (
              <div
                className="flex items-center justify-center rounded-full flex-shrink-0"
                style={{
                  width: 28,
                  height: 28,
                  background: 'var(--fm-green)',
                  color: '#fbf8f1',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {(user.user_metadata?.full_name ?? user.email ?? '').slice(0, 2).toUpperCase()}
              </div>
            )}
            <span
              className="flex-1 truncate"
              style={{ fontSize: 11.5, color: 'var(--fm-ink-3)' }}
            >
              {user.user_metadata?.full_name ?? user.email}
            </span>
            <button
              onClick={signOut}
              style={{ fontSize: 11.5, color: 'var(--fm-ink-3)', cursor: 'pointer', flexShrink: 0 }}
            >
              退出
            </button>
          </div>
        ) : (
          <button
            onClick={signIn}
            className="w-full py-2 rounded-lg transition-colors"
            style={{
              fontSize: 12.5,
              color: 'var(--fm-ink-2)',
              background: 'var(--fm-muted)',
              border: '1.5px solid var(--fm-line-2)',
              cursor: 'pointer',
              fontFamily: 'var(--font-geist-sans)',
            }}
          >
            登录留言
          </button>
        )}
        <div style={{ borderTop: '1px solid var(--fm-line)', marginTop: 10, paddingTop: 10 }}>
          <Link
            href="/about"
            style={{ fontSize: 11.5, color: 'var(--fm-ink-4)', fontFamily: 'var(--font-geist-mono)' }}
            className="about-back-link"
          >
            关于食迹
          </Link>
        </div>
      </div>
    </aside>
  )
}

// ── FilterLabel helper ────────────────────────────────────────────────────────
function FilterLabel({
  children,
  count = 0,
  countLabel,
}: {
  children: React.ReactNode
  count?: number
  countLabel?: string
}) {
  return (
    <p className="fm-filter-label">
      {children}
      {count > 0 && (
        <span className="fm-filter-label-count">{countLabel ?? count}</span>
      )}
    </p>
  )
}
