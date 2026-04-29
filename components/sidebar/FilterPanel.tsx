'use client'

import { useState } from 'react'
import type { Tag, FilterPayload } from '@/lib/types'
import {
  BROAD_REGIONS,
  HOOD_REGIONS,
  CUISINE_COLORS,
  CUISINE_BG,
  PRESET_TASTE_TAGS,
  PRESET_SCENE_TAGS,
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
  onAddPin?: () => void
  isOwner: boolean
  onCollapse?: () => void
}

const MAX_COST = 300

export default function FilterPanel({
  allTags,
  filters,
  onChange,
  restaurantCount,
  user,
  onAddPin,
  isOwner,
  onCollapse,
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
  const cuisineTags   = allTags.filter((t) => t.type === 'cuisine')
  const tasteTags     = allTags.filter((t) => t.type === 'taste')
  const sceneTags     = allTags.filter((t) => t.type === 'scene')

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
          {isOwner && onAddPin && (
            <button
              onClick={onAddPin}
              style={{
                padding: '6px 13px',
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 600,
                background: 'var(--fm-orange)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-geist-sans)',
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(217,107,44,0.25)',
              }}
            >
              ＋ 打地图钉
            </button>
          )}
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
      </div>

      {/* ── Scrollable filter body ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Region ── */}
        <section>
          <FilterLabel count={filters.regions.length}>区域</FilterLabel>

          {/* Broad regions: 3-column grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5, marginBottom: 5 }}>
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

          {/* Thin divider */}
          <div style={{ height: 1, background: 'var(--fm-line)', margin: '4px 0 6px' }} />

          {/* Neighbourhoods: 2-column grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 5 }}>
            {HOOD_REGIONS.map((r) => (
              <button
                key={r}
                className={`fm-chip${filters.regions.includes(r) ? ' active' : ''}`}
                style={{ fontSize: 11.5, padding: '6px 4px' }}
                onClick={() => toggleRegion(r)}
              >
                {r}
              </button>
            ))}
          </div>
        </section>

        {/* ── Cuisine ── */}
        {cuisineTags.length > 0 && (
          <section>
            <FilterLabel count={filters.cuisine_tags.length}>菜系</FilterLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {cuisineTags.map((t) => {
                const active = filters.cuisine_tags.includes(t.name)
                const fg = CUISINE_COLORS[t.name] ?? 'var(--fm-ink-2)'
                const bg = CUISINE_BG[t.name]     ?? 'var(--fm-muted)'
                return (
                  <button
                    key={t.id}
                    onClick={() => toggleArr('cuisine_tags', t.name)}
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
                    {t.name}
                  </button>
                )
              })}
            </div>
          </section>
        )}

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
