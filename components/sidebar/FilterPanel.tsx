'use client'

import { useState } from 'react'
import type { Tag, FilterPayload } from '@/lib/types'
import {
  BROAD_REGIONS,
  CUISINE_COLORS,
  CUISINE_BG,
  PRESET_TASTE_TAGS,
  PRESET_SCENE_TAGS,
  PRESET_CUISINE_TAGS,
  CHINESE_SUB_CUISINES,
  PRESET_DISH_TYPE_TAGS,
} from '@/lib/constants'
import type { User } from '@supabase/supabase-js'
import SmartSearchBar from './SmartSearchBar'
import { createClient } from '@/lib/supabase/client'

interface Props {
  allTags: Tag[]
  filters: FilterPayload
  onChange: (filters: FilterPayload) => void
  restaurantCount: number
  user: User | null
  isOwner: boolean
  onCollapse?: () => void
  viewMode?: 'map' | 'list'
  onViewModeChange?: (mode: 'map' | 'list') => void
}

const MAX_COST = 300

export default function FilterPanel({
  allTags,
  filters,
  onChange,
  restaurantCount,
  user,
  isOwner,
  onCollapse,
  viewMode = 'map',
  onViewModeChange,
}: Props) {
  const supabase = createClient()

  async function signIn() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
    location.reload()
  }

  // ── Tag helpers ──────────────────────────────────────────────────────────
  const tasteTags     = allTags.filter((t) => t.type === 'taste')
  const sceneTags     = allTags.filter((t) => t.type === 'scene')

  // Cuisine: always show preset top-level + sub-cuisines; append any extra DB tags
  const dbCuisineNames = allTags.filter((t) => t.type === 'cuisine').map((t) => t.name)
  const extraCuisineNames = dbCuisineNames.filter(
    (n) => !PRESET_CUISINE_TAGS.includes(n) && !CHINESE_SUB_CUISINES.includes(n)
  )
  const displayCuisineNames = [...PRESET_CUISINE_TAGS, ...extraCuisineNames]

  // Dish type (种类): always show presets; append any extra DB dish tags
  const dbDishNames = allTags.filter((t) => t.type === 'dish').map((t) => t.name)
  const extraDishNames = dbDishNames.filter((n) => !PRESET_DISH_TYPE_TAGS.includes(n))
  const displayDishTypeNames = [...PRESET_DISH_TYPE_TAGS, ...extraDishNames]

  const displayTasteTags = tasteTags.length > 0
    ? tasteTags
    : PRESET_TASTE_TAGS.map((name, i) => ({ id: `pt-${i}`, name, type: 'taste' as const, created_at: '' }))

  const displaySceneTags = sceneTags.length > 0
    ? sceneTags
    : PRESET_SCENE_TAGS.map((name, i) => ({ id: `ps-${i}`, name, type: 'scene' as const, created_at: '' }))

  // ── Toggle helpers ───────────────────────────────────────────────────────
  function toggleArr(key: keyof FilterPayload, name: string) {
    const arr = (filters[key] as string[]) ?? []
    onChange({ ...filters, [key]: arr.includes(name) ? arr.filter((n) => n !== name) : [...arr, name] })
  }

  function toggleRegion(region: string) {
    const next = filters.regions.includes(region)
      ? filters.regions.filter((r) => r !== region)
      : [...filters.regions, region]
    onChange({ ...filters, regions: next })
  }

  function handleCostMin(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value === '' ? null : Math.max(0, Number(e.target.value))
    onChange({ ...filters, min_cost: v })
  }

  function handleCostMax(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value === '' ? null : Math.min(MAX_COST, Number(e.target.value))
    onChange({ ...filters, max_cost: v })
  }

  function clearAll() {
    onChange({
      cuisine_tags: [],
      dish_tags:    [],
      taste_tags:   [],
      scene_tags:   [],
      max_cost:     null,
      min_cost:     null,
      area_keyword: null,
      regions:      [],
    })
  }

  const hasFilters =
    filters.cuisine_tags.length > 0 ||
    filters.dish_tags.length > 0 ||
    (filters.taste_tags?.length ?? 0) > 0 ||
    (filters.scene_tags?.length ?? 0) > 0 ||
    filters.max_cost !== null ||
    filters.min_cost !== null ||
    filters.area_keyword !== null ||
    filters.regions.length > 0

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
      {/* ── Header ── */}
      <div
        className="px-5 pt-5 pb-4 flex flex-col gap-3"
        style={{ borderBottom: '1px solid var(--fm-line)' }}
      >
        <div className="flex items-center justify-between">
          <div
            style={{
              fontFamily: 'var(--font-instrument-serif)',
              fontSize: 26,
              letterSpacing: '-0.01em',
              lineHeight: 1,
            }}
          >
            FoodMap<span style={{ color: 'var(--fm-orange)' }}>.</span>
          </div>

          <div className="flex items-center gap-2">
          {onCollapse && (
            <button
              onClick={onCollapse}
              title="折叠侧边栏"
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--fm-muted)',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--fm-ink-3)',
                fontSize: 14,
                flexShrink: 0,
              }}
            >
              ◂
            </button>
          )}
          </div>
        </div>

        {/* Smart search */}
        <SmartSearchBar
          allTags={allTags}
          onFilter={(payload) => onChange({ ...filters, ...payload })}
        />

        {/* View mode toggle */}
        {onViewModeChange && (
          <div
            style={{
              display: 'flex',
              background: 'var(--fm-cream)',
              borderRadius: 10,
              padding: 3,
              gap: 2,
            }}
          >
            {(['map', 'list'] as const).map((mode) => (
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
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6"/>
                    <line x1="8" y1="12" x2="21" y2="12"/>
                    <line x1="8" y1="18" x2="21" y2="18"/>
                    <line x1="3" y1="6" x2="3.01" y2="6"/>
                    <line x1="3" y1="12" x2="3.01" y2="12"/>
                    <line x1="3" y1="18" x2="3.01" y2="18"/>
                  </svg>
                )}
                {mode === 'map' ? '地图' : '列表'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Scrollable filter body ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Region ── */}
        <section>
          <FilterLabel count={filters.regions.length}>区域</FilterLabel>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
            {BROAD_REGIONS.map((r) => (
              <button
                key={r}
                className={`fm-chip${filters.regions.includes(r) ? ' active' : ''}`}
                style={{ fontSize: 12, padding: '6px 4px' }}
                onClick={() => toggleRegion(r)}
              >
                {r}
              </button>
            ))}
          </div>
        </section>

        {/* ── Cuisine ── */}
        <section>
          <FilterLabel count={filters.cuisine_tags.length}>菜系</FilterLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {displayCuisineNames.map((name) => {
              const active = filters.cuisine_tags.includes(name)
              const fg = CUISINE_COLORS[name] ?? 'var(--fm-ink-2)'
              const bg = CUISINE_BG[name]     ?? 'var(--fm-muted)'
              return (
                <button
                  key={name}
                  onClick={() => toggleArr('cuisine_tags', name)}
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
                  {name}
                </button>
              )
            })}
          </div>
          {/* Chinese sub-cuisines */}
          <div style={{ marginTop: 6, paddingLeft: 2, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {CHINESE_SUB_CUISINES.map((name) => {
              const active = filters.cuisine_tags.includes(name)
              const fg = CUISINE_COLORS[name] ?? 'var(--fm-ink-2)'
              const bg = CUISINE_BG[name]     ?? 'var(--fm-muted)'
              return (
                <button
                  key={name}
                  onClick={() => toggleArr('cuisine_tags', name)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 6,
                    fontSize: 11.5,
                    fontWeight: 500,
                    fontFamily: 'var(--font-geist-sans)',
                    background: active ? fg : bg,
                    color: active ? '#fff' : fg,
                    border: `1.5px solid ${active ? fg : 'transparent'}`,
                    cursor: 'pointer',
                    transition: 'all 0.12s',
                  }}
                >
                  {name}
                </button>
              )
            })}
          </div>
        </section>

        {/* ── Dish type (种类) ── */}
        <section>
          <FilterLabel count={filters.dish_tags.length}>种类</FilterLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {displayDishTypeNames.map((name) => {
              const active = filters.dish_tags.includes(name)
              return (
                <button
                  key={name}
                  onClick={() => toggleArr('dish_tags', name)}
                  className={`fm-chip${active ? ' active' : ''}`}
                  style={{ fontSize: 12 }}
                >
                  {name}
                </button>
              )
            })}
          </div>
        </section>

        {/* ── Cost range ── */}
        <section>
          <FilterLabel count={(filters.min_cost || filters.max_cost) ? 1 : 0} countLabel="已设">
            人均消费 (S$)
          </FilterLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="number"
              value={filters.min_cost ?? ''}
              onChange={handleCostMin}
              placeholder="下限"
              min={0}
              max={MAX_COST}
              style={costInputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--fm-ink)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--fm-line-2)')}
            />
            <span style={{ color: 'var(--fm-ink-4)', fontFamily: 'var(--font-geist-mono)', fontSize: 13 }}>–</span>
            <input
              type="number"
              value={filters.max_cost ?? ''}
              onChange={handleCostMax}
              placeholder="上限"
              min={0}
              max={MAX_COST}
              style={costInputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--fm-ink)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--fm-line-2)')}
            />
            <span style={{ fontSize: 11, color: 'var(--fm-ink-4)', whiteSpace: 'nowrap' }}>每人</span>
          </div>
        </section>

        {/* ── Taste ── */}
        <section>
          <FilterLabel count={filters.taste_tags?.length ?? 0}>口味</FilterLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {displayTasteTags.map((t) => {
              const active = (filters.taste_tags ?? []).includes(t.name)
              return (
                <button
                  key={t.id}
                  onClick={() => toggleArr('taste_tags', t.name)}
                  className={`fm-chip fm-chip-taste${active ? ' active' : ''}`}
                  style={{ fontSize: 12 }}
                >
                  {t.name}
                </button>
              )
            })}
          </div>
        </section>

        {/* ── Scene ── */}
        <section>
          <FilterLabel count={filters.scene_tags?.length ?? 0}>场合</FilterLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {displaySceneTags.map((t) => {
              const active = (filters.scene_tags ?? []).includes(t.name)
              return (
                <button
                  key={t.id}
                  onClick={() => toggleArr('scene_tags', t.name)}
                  className={`fm-chip fm-chip-scene${active ? ' active' : ''}`}
                  style={{ fontSize: 12 }}
                >
                  {t.name}
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
          {hasFilters && (
            <button
              onClick={clearAll}
              style={{ color: 'var(--fm-orange-dark)', cursor: 'pointer', fontSize: 11.5 }}
            >
              重置
            </button>
          )}
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
                {user.email?.slice(0, 2).toUpperCase()}
              </div>
            )}
            <span
              className="flex-1 truncate"
              style={{ fontSize: 11.5, color: 'var(--fm-ink-3)' }}
            >
              {user.email}
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
            登录编辑
          </button>
        )}
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
