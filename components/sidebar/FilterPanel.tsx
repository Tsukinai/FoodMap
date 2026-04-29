'use client'

import { useState } from 'react'
import type { Tag, FilterPayload } from '@/lib/types'
import { REGIONS, PRESET_TASTE_TAGS } from '@/lib/constants'
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
}

const COST_BRACKETS = [
  { label: '< $15', min: null, max: 15 },
  { label: '$15–30', min: 15, max: 30 },
  { label: '$30–60', min: 30, max: 60 },
  { label: '$60–120', min: 60, max: 120 },
  { label: '$120+', min: 120, max: null },
]

export default function FilterPanel({ allTags, filters, onChange, restaurantCount, user, onAddPin, isOwner }: Props) {
  const [costBracket, setCostBracket] = useState<number | null>(null)
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

  const cuisineTags = allTags.filter((t) => t.type === 'cuisine')
  const tasteTags = allTags.filter((t) => t.type === 'taste')
  const displayTasteTags = tasteTags.length > 0 ? tasteTags : PRESET_TASTE_TAGS.map((name, i) => ({ id: `preset-${i}`, name, type: 'taste' as const, created_at: '' }))

  function toggleTag(key: keyof FilterPayload, name: string) {
    const arr = (filters[key] as string[]) ?? []
    const next = arr.includes(name) ? arr.filter((n) => n !== name) : [...arr, name]
    onChange({ ...filters, [key]: next })
  }

  function toggleRegion(region: string) {
    const current = filters.regions ?? []
    const next = current.includes(region) ? current.filter((r) => r !== region) : [...current, region]
    onChange({ ...filters, regions: next })
  }

  function selectCostBracket(idx: number) {
    if (costBracket === idx) {
      setCostBracket(null)
      onChange({ ...filters, min_cost: null, max_cost: null })
    } else {
      const b = COST_BRACKETS[idx]
      setCostBracket(idx)
      onChange({ ...filters, min_cost: b.min, max_cost: b.max })
    }
  }

  function clearAll() {
    setCostBracket(null)
    onChange({ cuisine_tags: [], dish_tags: [], taste_tags: [], scene_tags: [], max_cost: null, min_cost: null, area_keyword: null, regions: [] })
  }

  const hasFilters =
    filters.cuisine_tags.length > 0 ||
    filters.dish_tags.length > 0 ||
    (filters.taste_tags?.length ?? 0) > 0 ||
    filters.max_cost !== null ||
    filters.min_cost !== null ||
    filters.area_keyword !== null ||
    filters.regions.length > 0

  return (
    <aside
      className="h-full flex flex-col border-r overflow-hidden"
      style={{
        width: 300,
        background: 'var(--fm-paper)',
        borderColor: 'var(--fm-line)',
        color: 'var(--fm-ink)',
      }}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-4" style={{ borderBottom: '1px solid var(--fm-line)' }}>
        <div style={{ fontFamily: 'var(--font-instrument-serif)', fontSize: 26, letterSpacing: '-0.01em', lineHeight: 1 }}>
          FoodMap<span style={{ color: 'var(--fm-orange)' }}>.</span>
        </div>
      </div>

      {/* Smart search */}
      <div className="px-4 pt-4 pb-3">
        <SmartSearchBar
          allTags={allTags}
          onFilter={(payload) => onChange({ ...filters, ...payload })}
        />
      </div>

      {/* Scrollable filter body */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-5">

        {/* Region */}
        <section>
          <SectionLabel>区域</SectionLabel>
          <div className="flex flex-col gap-0.5">
            {REGIONS.map((region) => {
              const active = (filters.regions ?? []).includes(region)
              return (
                <button
                  key={region}
                  onClick={() => toggleRegion(region)}
                  className="flex items-center gap-2 text-sm px-2 py-2 rounded-md text-left transition-colors"
                  style={{
                    background: active ? '#efe8d6' : 'transparent',
                    color: 'var(--fm-ink-2)',
                  }}
                >
                  <span
                    className="flex items-center justify-center rounded"
                    style={{
                      width: 18, height: 18, border: '1.5px solid',
                      borderColor: active ? 'var(--fm-ink)' : 'var(--fm-ink-3)',
                      background: active ? 'var(--fm-ink)' : 'transparent',
                      color: '#fbf8f1', fontSize: 11, flexShrink: 0,
                    }}
                  >
                    {active ? '✓' : ''}
                  </span>
                  {region}
                </button>
              )
            })}
          </div>
        </section>

        {/* Cuisine tags */}
        {cuisineTags.length > 0 && (
          <section>
            <SectionLabel>菜系</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {cuisineTags.map((t) => {
                const active = filters.cuisine_tags.includes(t.name)
                return (
                  <button
                    key={t.id}
                    onClick={() => toggleTag('cuisine_tags', t.name)}
                    className={`fm-tag fm-tag-cuisine transition-all${active ? ' fm-tag-active' : ''}`}
                    style={{ cursor: 'pointer' }}
                  >
                    {t.name}
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* Cost bracket */}
        <section>
          <SectionLabel>人均消费</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {COST_BRACKETS.map((b, i) => {
              const active = costBracket === i
              return (
                <button
                  key={b.label}
                  onClick={() => selectCostBracket(i)}
                  className="text-sm px-3 py-1.5 rounded-full border transition-all"
                  style={{
                    fontFamily: 'var(--font-geist-mono)',
                    background: active ? 'var(--fm-ink)' : 'var(--fm-paper)',
                    color: active ? '#fbf8f1' : 'var(--fm-ink-2)',
                    borderColor: active ? 'var(--fm-ink)' : 'var(--fm-line-2)',
                  }}
                >
                  {b.label}
                </button>
              )
            })}
          </div>
        </section>

        {/* Taste tags */}
        <section>
          <SectionLabel>口味</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {displayTasteTags.map((t) => {
              const active = (filters.taste_tags ?? []).includes(t.name)
              return (
                <button
                  key={t.id}
                  onClick={() => toggleTag('taste_tags', t.name)}
                  className={`fm-tag fm-tag-taste transition-all${active ? ' fm-tag-active' : ''}`}
                  style={{ opacity: active ? 1 : 0.75, cursor: 'pointer' }}
                >
                  {t.name}
                </button>
              )
            })}
          </div>
        </section>
      </div>

      {/* Footer */}
      <div
        className="px-4 pt-2.5 pb-3 flex flex-col gap-2.5"
        style={{ borderTop: '1px dashed var(--fm-line-2)', fontFamily: 'var(--font-geist-mono)' }}
      >
        {/* Count + clear */}
        <div
          className="flex items-center justify-between"
          style={{ fontSize: '1rem', color: 'var(--fm-ink-3)' }}
        >
          <span>{restaurantCount} 个钉</span>
          {hasFilters && (
            <button onClick={clearAll} style={{ color: 'var(--fm-orange-dark)', cursor: 'pointer' }}>
              重置
            </button>
          )}
        </div>

        {/* User section */}
        {user ? (
          <div className="flex items-center gap-2">
            <div
              className="flex items-center justify-center rounded-full flex-shrink-0"
              style={{ width: 32, height: 32, background: 'var(--fm-green)', color: '#fbf8f1', fontSize: '1rem', fontWeight: 600 }}
            >
              {user.email?.slice(0, 2).toUpperCase()}
            </div>
            <span
              className="flex-1 truncate"
              style={{ fontSize: '1rem', color: 'var(--fm-ink-3)' }}
            >
              {user.email}
            </span>
            <button
              onClick={signOut}
              style={{ fontSize: '1rem', color: 'var(--fm-ink-3)', cursor: 'pointer', flexShrink: 0 }}
            >
              退出
            </button>
          </div>
        ) : (
          <button
            onClick={signIn}
            className="w-full py-1.5 rounded-md transition-colors"
            style={{
              fontSize: '1rem',
              color: 'var(--fm-ink-2)',
              background: 'var(--fm-muted)',
              border: '1px solid var(--fm-line-2)',
              cursor: 'pointer',
            }}
          >
            登录编辑
          </button>
        )}
      </div>
    </aside>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mb-2"
      style={{
        fontFamily: 'var(--font-geist-mono)',
        fontSize: '1rem',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'var(--fm-ink-3)',
        fontWeight: 600,
      }}
    >
      {children}
    </p>
  )
}
