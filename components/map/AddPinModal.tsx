'use client'

import { useState, useEffect } from 'react'
import type { Tag } from '@/lib/types'
import { PRESET_TASTE_TAGS, PRESET_SCENE_TAGS } from '@/lib/constants'
import TagInput from '@/components/tags/TagInput'

interface Props {
  lng: number
  lat: number
  onClose: () => void
  onSaved: () => void
}

const COST_BRACKETS = [
  { label: '< 15', min: null, max: 15 },
  { label: '15–30', min: 15, max: 30 },
  { label: '30–60', min: 30, max: 60 },
  { label: '60–120', min: 60, max: 120 },
  { label: '120+', min: 120, max: null },
]

export default function AddPinModal({ lng, lat, onClose, onSaved }: Props) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [costBracket, setCostBracket] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [cuisineTagIds, setCuisineTagIds] = useState<string[]>([])
  const [dishTagIds, setDishTagIds] = useState<string[]>([])
  const [tasteTagIds, setTasteTagIds] = useState<string[]>([])
  const [sceneTagIds, setSceneTagIds] = useState<string[]>([])
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [saving, setSaving] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [geoResults, setGeoResults] = useState<{ address: string; postal_code: string; lng: number; lat: number }[]>([])
  const [pinLng, setPinLng] = useState(lng)
  const [pinLat, setPinLat] = useState(lat)

  useEffect(() => {
    fetch('/api/tags').then((r) => r.json()).then(setAllTags)
  }, [])

  // Ensure preset taste/scene tags exist in allTags for the TagInput
  const tasteTags = allTags.filter((t) => t.type === 'taste')
  const sceneTags = allTags.filter((t) => t.type === 'scene')

  const displayTasteTags: Tag[] = tasteTags.length > 0
    ? tasteTags
    : PRESET_TASTE_TAGS.map((name, i) => ({ id: `preset-taste-${i}`, name, type: 'taste' as const, created_at: '' }))

  const displaySceneTags: Tag[] = sceneTags.length > 0
    ? sceneTags
    : PRESET_SCENE_TAGS.map((name, i) => ({ id: `preset-scene-${i}`, name, type: 'scene' as const, created_at: '' }))

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
    const bracket = costBracket !== null ? COST_BRACKETS[costBracket] : null
    try {
      await fetch('/api/restaurants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          address: address || null,
          postal_code: postalCode || null,
          lng: pinLng,
          lat: pinLat,
          cost_min: bracket?.min ?? null,
          cost_max: bracket?.max ?? null,
          notes: notes || null,
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
              fontSize: '1rem',
              color: 'var(--fm-ink-3)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 6,
            }}
          >
            新建地图钉
          </div>
          <div
            style={{
              fontFamily: 'var(--font-instrument-serif)',
              fontSize: 32,
              lineHeight: 1,
              marginBottom: 20,
            }}
          >
            打一个新地图钉
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
                placeholder="邮编 / 地址搜索"
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

          {address && (
            <p style={{ fontSize: '1rem', color: 'var(--fm-ink-3)', fontFamily: 'var(--font-geist-mono)', marginBottom: 14 }}>
              {address}{postalCode ? ` · ${postalCode}` : ''}
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
            />
          </FormSection>

          {/* Dish tags */}
          <FormSection label="招牌菜品">
            <TagInput
              type="dish"
              allTags={allTags}
              selectedIds={dishTagIds}
              onChange={setDishTagIds}
              onTagCreated={(tag) => setAllTags((prev) => [...prev, tag])}
            />
          </FormSection>

          {/* Cost + Taste row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 14 }}>
            <FormSection label="人均消费 (S$)" noMargin>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {COST_BRACKETS.map((b, i) => {
                  const active = costBracket === i
                  return (
                    <button
                      key={b.label}
                      onClick={() => setCostBracket(active ? null : i)}
                      className="text-base px-3 py-1.5 rounded-full border transition-all"
                      style={{
                        fontFamily: 'var(--font-geist-mono)',
                        fontSize: '1rem',
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
            </FormSection>

            <FormSection label="口味" noMargin>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {displayTasteTags.map((t) => {
                  const active = tasteTagIds.includes(t.id)
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        setTasteTagIds(active ? tasteTagIds.filter((id) => id !== t.id) : [...tasteTagIds, t.id])
                      }}
                      className="fm-tag fm-tag-taste"
                      style={{ outline: active ? '1.5px solid var(--fm-orange-dark)' : 'none', cursor: 'pointer' }}
                    >
                      {t.name}
                    </button>
                  )
                })}
              </div>
            </FormSection>
          </div>

          {/* Scene tags */}
          <FormSection label="场合">
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {displaySceneTags.map((t) => {
                const active = sceneTagIds.includes(t.id)
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSceneTagIds(active ? sceneTagIds.filter((id) => id !== t.id) : [...sceneTagIds, t.id])
                    }}
                    className="fm-tag fm-tag-scene"
                    style={{ outline: active ? '1.5px solid #4a3d6b' : 'none', cursor: 'pointer' }}
                  >
                    {t.name}
                  </button>
                )
              })}
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
                fontSize: '1rem',
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
              disabled={saving || !name.trim()}
              style={{
                padding: '10px 18px',
                borderRadius: 8,
                fontSize: '1rem',
                fontWeight: 500,
                border: '1px solid var(--fm-orange)',
                background: saving || !name.trim() ? 'var(--fm-ink-4)' : 'var(--fm-orange)',
                borderColor: saving || !name.trim() ? 'var(--fm-ink-4)' : 'var(--fm-orange)',
                color: '#fff',
                cursor: saving || !name.trim() ? 'default' : 'pointer',
                fontFamily: 'var(--font-geist-sans)',
                boxShadow: '0 4px 10px rgba(217,107,44,0.25)',
              }}
            >
              {saving ? '保存中…' : '保存为新钉'}
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

function FormSection({ label, children, noMargin }: { label: string; children: React.ReactNode; noMargin?: boolean }) {
  return (
    <div style={{ marginBottom: noMargin ? 0 : 14 }}>
      <p
        style={{
          fontFamily: 'var(--font-geist-mono)',
          fontSize: '1rem',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--fm-ink-3)',
          fontWeight: 600,
          marginBottom: 8,
        }}
      >
        {label}
      </p>
      {children}
    </div>
  )
}
