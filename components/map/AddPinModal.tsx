'use client'

import { useState, useEffect } from 'react'
import type { Tag, Restaurant, RestaurantStatus } from '@/lib/types'
import { PRESET_TASTE_TAGS, PRESET_SCENE_TAGS, PRESET_CUISINE_TAGS, CHINESE_SUB_CUISINES, PRESET_DISH_TYPE_TAGS } from '@/lib/constants'
import TagInput from '@/components/tags/TagInput'

interface Props {
  restaurant?: Restaurant
  lng?: number
  lat?: number
  onClose: () => void
  onSaved: () => void
}

const MAX_COST = 200

export default function AddPinModal({ restaurant, lng, lat, onClose, onSaved }: Props) {
  const [name, setName] = useState(restaurant?.name ?? '')
  const [address, setAddress] = useState(restaurant?.address ?? '')
  const [postalCode, setPostalCode] = useState(restaurant?.postal_code ?? '')
  const [costRange, setCostRange] = useState<[number, number]>([
    restaurant?.cost_min ?? 0,
    restaurant?.cost_max ?? MAX_COST,
  ])
  const [notes, setNotes] = useState(restaurant?.notes ?? '')
  const [signatureDishes, setSignatureDishes] = useState<string[]>(restaurant?.signature_dishes ?? [])
  const [cuisineTagIds, setCuisineTagIds] = useState<string[]>(
    restaurant?.tags.filter((t) => t.type === 'cuisine').map((t) => t.id) ?? []
  )
  const [dishTagIds, setDishTagIds] = useState<string[]>(
    restaurant?.tags.filter((t) => t.type === 'dish').map((t) => t.id) ?? []
  )
  const [tasteTagIds, setTasteTagIds] = useState<string[]>(
    restaurant?.tags.filter((t) => t.type === 'taste').map((t) => t.id) ?? []
  )
  const [sceneTagIds, setSceneTagIds] = useState<string[]>(
    restaurant?.tags.filter((t) => t.type === 'scene').map((t) => t.id) ?? []
  )
  const [status, setStatus] = useState<RestaurantStatus>(restaurant?.status ?? 'visited')
  const [allTags, setAllTags] = useState<Tag[]>(restaurant?.tags ?? [])
  const [saving, setSaving] = useState(false)
  const [togglingTag, setTogglingTag] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [geoResults, setGeoResults] = useState<{ address: string; postal_code: string; lng: number; lat: number }[]>([])
  const [pinLng, setPinLng] = useState(restaurant?.location_lng ?? lng ?? 0)
  const [pinLat, setPinLat] = useState(restaurant?.location_lat ?? lat ?? 0)

  useEffect(() => {
    fetch('/api/tags').then((r) => r.json()).then(setAllTags)
  }, [])

  async function ensureTagInModal(name: string, type: Tag['type']): Promise<Tag> {
    const existing = allTags.find((t) => t.type === type && t.name === name)
    if (existing) return existing
    const res = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type }),
    })
    const tag: Tag = await res.json()
    setAllTags((prev) => (prev.some((t) => t.id === tag.id) ? prev : [...prev, tag]))
    return tag
  }

  function isTagNameSelected(name: string, type: 'taste' | 'scene'): boolean {
    const tag = allTags.find((t) => t.type === type && t.name === name)
    return tag ? (type === 'taste' ? tasteTagIds : sceneTagIds).includes(tag.id) : false
  }

  async function toggleTasteByName(name: string) {
    if (togglingTag) return
    const existing = allTags.find((t) => t.type === 'taste' && t.name === name)
    if (existing && tasteTagIds.includes(existing.id)) {
      setTasteTagIds((prev) => prev.filter((id) => id !== existing.id))
      return
    }
    setTogglingTag(name)
    try {
      const realTag = await ensureTagInModal(name, 'taste')
      setTasteTagIds((prev) => (prev.includes(realTag.id) ? prev : [...prev, realTag.id]))
    } finally {
      setTogglingTag(null)
    }
  }

  async function toggleSceneByName(name: string) {
    if (togglingTag) return
    const existing = allTags.find((t) => t.type === 'scene' && t.name === name)
    if (existing && sceneTagIds.includes(existing.id)) {
      setSceneTagIds((prev) => prev.filter((id) => id !== existing.id))
      return
    }
    setTogglingTag(name)
    try {
      const realTag = await ensureTagInModal(name, 'scene')
      setSceneTagIds((prev) => (prev.includes(realTag.id) ? prev : [...prev, realTag.id]))
    } finally {
      setTogglingTag(null)
    }
  }

  async function handleGeoSearch() {
    if (!searchQuery.trim()) return
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(searchQuery)}`)
    const results = await res.json()
    setGeoResults(results)
  }

  function selectGeoResult(r: typeof geoResults[0]) {
    setAddress(r.address)
    setPostalCode(r.postal_code)
    setPinLng(r.lng)
    setPinLat(r.lat)
    setGeoResults([])
    setSearchQuery('')
  }

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const url = restaurant ? `/api/restaurants/${restaurant.id}` : '/api/restaurants'
      await fetch(url, {
        method: restaurant ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          address: address || null,
          postal_code: postalCode || null,
          lng: pinLng,
          lat: pinLat,
          cost_min: costRange[0] === 0 ? null : costRange[0],
          cost_max: costRange[1] === MAX_COST ? null : costRange[1],
          notes: notes || null,
          signature_dishes: signatureDishes,
          status,
          cuisine_tag_ids: cuisineTagIds,
          dish_tag_ids: dishTagIds,
          taste_tag_ids: tasteTagIds,
          scene_tag_ids: sceneTagIds,
        }),
      })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(31,28,24,0.4)', backdropFilter: 'blur(2px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative rounded-xl overflow-hidden flex flex-col"
        style={{
          width: 680,
          maxWidth: '95vw',
          maxHeight: '90vh',
          background: 'var(--fm-paper)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
          color: 'var(--fm-ink)',
          fontFamily: 'var(--font-geist-sans)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '28px 36px 0' }}>
          <div
            style={{
              fontFamily: 'var(--font-geist-mono)',
              fontSize: 10,
              color: 'var(--fm-ink-4)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontWeight: 500,
              marginBottom: 6,
            }}
          >
            {restaurant ? '编辑地图钉' : '新建地图钉'}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-instrument-serif)',
              fontSize: 32,
              lineHeight: 1,
              marginBottom: 20,
            }}
          >
            {restaurant ? restaurant.name : '打一个新地图钉'}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto" style={{ padding: '0 36px 28px' }}>
          {/* Name + Address row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <FmInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="餐馆名称 *"
            />
            <div className="relative">
              <FmInput
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGeoSearch()}
                placeholder="邮编 / 地址搜索 *"
              />
              {geoResults.length > 0 && (
                <div
                  className="absolute top-full left-0 right-0 z-10 rounded-lg overflow-hidden"
                  style={{
                    border: '1px solid var(--fm-line-2)',
                    background: 'var(--fm-paper)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                    marginTop: 4,
                    maxHeight: 160,
                    overflowY: 'auto',
                  }}
                >
                  {geoResults.map((r, i) => (
                    <button
                      key={i}
                      className="w-full text-left px-3 py-2.5 text-base transition-colors"
                      style={{ color: 'var(--fm-ink-2)', borderBottom: '1px solid var(--fm-line)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--fm-muted)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      onClick={() => selectGeoResult(r)}
                    >
                      {r.address}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {address ? (
            <p style={{ fontSize: 13, color: 'var(--fm-ink-3)', fontFamily: 'var(--font-geist-mono)', marginBottom: 14 }}>
              {address}{postalCode ? ` · ${postalCode}` : ''}
            </p>
          ) : (
            <p style={{ fontSize: 12, color: 'var(--fm-ink-4)', fontFamily: 'var(--font-geist-mono)', marginBottom: 14 }}>
              请搜索并从下拉列表中选择地址
            </p>
          )}

          {/* Cuisine tags */}
          <FormSection label="菜系">
            <TagInput
              type="cuisine"
              allTags={allTags}
              selectedIds={cuisineTagIds}
              onChange={setCuisineTagIds}
              onTagCreated={(tag) => setAllTags((prev) => [...prev, tag])}
              onTagDeleted={(id) => setAllTags((prev) => prev.filter((t) => t.id !== id))}
              canManage
              presets={PRESET_CUISINE_TAGS}
              subPresets={CHINESE_SUB_CUISINES}
              subPresetsParent="中餐"
            />
          </FormSection>

          {/* Signature dishes */}
          <FormSection label="招牌菜">
            <SignatureDishInput dishes={signatureDishes} onChange={setSignatureDishes} />
          </FormSection>

          {/* Dish tags */}
          <FormSection label="种类 / 菜品">
            <TagInput
              type="dish"
              allTags={allTags}
              selectedIds={dishTagIds}
              onChange={setDishTagIds}
              onTagCreated={(tag) => setAllTags((prev) => [...prev, tag])}
              onTagDeleted={(id) => setAllTags((prev) => prev.filter((t) => t.id !== id))}
              canManage
              presets={PRESET_DISH_TYPE_TAGS}
            />
          </FormSection>

          {/* Cost + Taste row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 14 }}>
            <FormSection label="人均消费 (S$)" noMargin>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 13, color: 'var(--fm-ink-3)' }}>$</span>
                <input
                  type="number"
                  value={costRange[0] === 0 ? '' : costRange[0]}
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(Number(e.target.value) || 0, costRange[1]))
                    setCostRange([v, costRange[1]])
                  }}
                  placeholder="最少"
                  min={0}
                  style={{ width: 64, border: '1px solid var(--fm-line-2)', borderRadius: 6, padding: '6px 8px', fontSize: 13, fontFamily: 'var(--font-geist-mono)', color: 'var(--fm-ink)', outline: 'none', textAlign: 'center', background: 'var(--fm-paper)' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--fm-ink)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--fm-line-2)')}
                />
                <span style={{ color: 'var(--fm-ink-3)', fontFamily: 'var(--font-geist-mono)', fontSize: 13 }}>–</span>
                <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 13, color: 'var(--fm-ink-3)' }}>$</span>
                <input
                  type="number"
                  value={costRange[1] === MAX_COST ? '' : costRange[1]}
                  onChange={(e) => {
                    const raw = e.target.value === '' ? MAX_COST : Number(e.target.value)
                    const v = Math.max(costRange[0], Math.min(raw, MAX_COST))
                    setCostRange([costRange[0], v])
                  }}
                  placeholder="不限"
                  min={0}
                  style={{ width: 64, border: '1px solid var(--fm-line-2)', borderRadius: 6, padding: '6px 8px', fontSize: 13, fontFamily: 'var(--font-geist-mono)', color: 'var(--fm-ink)', outline: 'none', textAlign: 'center', background: 'var(--fm-paper)' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--fm-ink)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--fm-line-2)')}
                />
              </div>
            </FormSection>

            <FormSection label="口味" noMargin>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {PRESET_TASTE_TAGS.map((name) => {
                  const active = isTagNameSelected(name, 'taste')
                  const loading = togglingTag === name
                  return (
                    <button
                      key={name}
                      onClick={() => toggleTasteByName(name)}
                      disabled={loading}
                      className="fm-tag fm-tag-taste"
                      style={{ outline: active ? '1.5px solid var(--fm-orange-dark)' : 'none', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1 }}
                    >
                      {name}
                    </button>
                  )
                })}
              </div>
            </FormSection>
          </div>

          {/* Scene tags */}
          <FormSection label="场合">
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {PRESET_SCENE_TAGS.map((name) => {
                const active = isTagNameSelected(name, 'scene')
                const loading = togglingTag === name
                return (
                  <button
                    key={name}
                    onClick={() => toggleSceneByName(name)}
                    disabled={loading}
                    className="fm-tag fm-tag-scene"
                    style={{ outline: active ? '1.5px solid #4a3d6b' : 'none', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1 }}
                  >
                    {name}
                  </button>
                )
              })}
            </div>
          </FormSection>

          {/* Status */}
          <FormSection label="状态">
            <div style={{ display: 'flex', gap: 6 }}>
              {([['want', '想吃'], ['visited', '已吃']] as [RestaurantStatus, string][]).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setStatus(val)}
                  style={{
                    flex: 1,
                    padding: '8px 0',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 500,
                    fontFamily: 'var(--font-geist-sans)',
                    border: status === val
                      ? val === 'want' ? '1.5px solid #c8883a' : '1.5px solid var(--fm-green)'
                      : '1px solid var(--fm-line-2)',
                    background: status === val
                      ? val === 'want' ? '#fdf0e6' : '#eaf4ee'
                      : 'var(--fm-paper)',
                    color: status === val
                      ? val === 'want' ? '#c8883a' : 'var(--fm-green)'
                      : 'var(--fm-ink-3)',
                    cursor: 'pointer',
                    transition: 'all 0.12s',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </FormSection>

          {/* Notes */}
          <FormSection label="笔记">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="推荐菜品、特别提示、下次记得…"
              style={{
                width: '100%',
                minHeight: 72,
                borderRadius: 8,
                border: '1px solid var(--fm-line-2)',
                background: 'var(--fm-paper)',
                padding: '10px 12px',
                fontSize: '1rem',
                fontFamily: 'var(--font-geist-sans)',
                color: 'var(--fm-ink)',
                resize: 'none',
                outline: 'none',
                fontStyle: 'italic',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--fm-ink)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--fm-line-2)')}
            />
          </FormSection>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button
              onClick={onClose}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                fontSize: 13.5,
                fontWeight: 500,
                border: '1px solid var(--fm-line-2)',
                background: 'transparent',
                color: 'var(--fm-ink-2)',
                cursor: 'pointer',
                fontFamily: 'var(--font-geist-sans)',
              }}
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim() || !address.trim()}
              style={{
                padding: '10px 18px',
                borderRadius: 8,
                fontSize: 13.5,
                fontWeight: 500,
                border: '1px solid var(--fm-orange)',
                background: saving || !name.trim() || !address.trim() ? 'var(--fm-ink-4)' : 'var(--fm-orange)',
                borderColor: saving || !name.trim() || !address.trim() ? 'var(--fm-ink-4)' : 'var(--fm-orange)',
                color: '#fff',
                cursor: saving || !name.trim() || !address.trim() ? 'default' : 'pointer',
                fontFamily: 'var(--font-geist-sans)',
                boxShadow: '0 4px 10px rgba(217,107,44,0.25)',
              }}
            >
              {saving ? '保存中…' : restaurant ? '保存' : '保存为新钉'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function FmInput({ value, onChange, onKeyDown, placeholder }: {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  placeholder?: string
}) {
  return (
    <input
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      style={{
        width: '100%',
        background: 'var(--fm-paper)',
        border: '1px solid var(--fm-line-2)',
        borderRadius: 8,
        padding: '12px 14px',
        fontSize: '1rem',
        fontFamily: 'var(--font-geist-sans)',
        color: 'var(--fm-ink)',
        outline: 'none',
      }}
      onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--fm-ink)')}
      onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--fm-line-2)')}
    />
  )
}

function SignatureDishInput({ dishes, onChange }: { dishes: string[]; onChange: (d: string[]) => void }) {
  const [input, setInput] = useState('')

  function add() {
    const name = input.trim()
    if (!name || dishes.includes(name)) return
    onChange([...dishes, name])
    setInput('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {dishes.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {dishes.map((d) => (
            <button
              key={d}
              onClick={() => onChange(dishes.filter((x) => x !== d))}
              className="fm-tag fm-tag-dish"
              style={{ cursor: 'pointer' }}
            >
              {d} <span style={{ opacity: 0.6 }}>✕</span>
            </button>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder="输入招牌菜名，Enter 添加…"
          style={{
            flex: 1,
            background: 'var(--fm-paper)',
            border: '1px solid var(--fm-line-2)',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: '1rem',
            fontFamily: 'var(--font-geist-sans)',
            color: 'var(--fm-ink)',
            outline: 'none',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--fm-ink)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--fm-line-2)')}
        />
        <button
          onClick={add}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            fontSize: 13,
            fontFamily: 'var(--font-geist-sans)',
            background: 'var(--fm-muted)',
            border: '1px solid var(--fm-line-2)',
            color: 'var(--fm-ink-2)',
            cursor: 'pointer',
          }}
        >
          添加
        </button>
      </div>
    </div>
  )
}

function FormSection({ label, children, noMargin }: { label: string; children: React.ReactNode; noMargin?: boolean }) {
  return (
    <div style={{ marginBottom: noMargin ? 0 : 14 }}>
      <p
        style={{
          fontFamily: 'var(--font-geist-mono)',
          fontSize: 10,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--fm-ink-4)',
          fontWeight: 500,
          marginBottom: 8,
        }}
      >
        {label}
      </p>
      {children}
    </div>
  )
}
