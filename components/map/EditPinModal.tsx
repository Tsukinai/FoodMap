'use client'

import { useState, useEffect } from 'react'
import type { Tag, Restaurant } from '@/lib/types'
import TagInput from '@/components/tags/TagInput'
import { Slider } from '@/components/ui/slider'

interface Props {
  restaurant: Restaurant
  onClose: () => void
  onSaved: () => void
}

const MAX_COST = 200

export default function EditPinModal({ restaurant, onClose, onSaved }: Props) {
  const [name, setName] = useState(restaurant.name)
  const [notes, setNotes] = useState(restaurant.notes ?? '')
  const [costRange, setCostRange] = useState<[number, number]>([
    restaurant.cost_min ?? 0,
    restaurant.cost_max ?? MAX_COST,
  ])
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [cuisineTagIds, setCuisineTagIds] = useState<string[]>(
    restaurant.tags.filter((t) => t.type === 'cuisine').map((t) => t.id)
  )
  const [dishTagIds, setDishTagIds] = useState<string[]>(
    restaurant.tags.filter((t) => t.type === 'dish').map((t) => t.id)
  )
  const [tasteTagIds, setTasteTagIds] = useState<string[]>(
    restaurant.tags.filter((t) => t.type === 'taste').map((t) => t.id)
  )
  const [sceneTagIds, setSceneTagIds] = useState<string[]>(
    restaurant.tags.filter((t) => t.type === 'scene').map((t) => t.id)
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/tags').then((r) => r.json()).then(setAllTags)
  }, [])

  function handleCostSlider(values: number | readonly number[]) {
    setCostRange(values as [number, number])
  }

  function handleMinInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = Math.max(0, Math.min(Number(e.target.value) || 0, costRange[1]))
    setCostRange([v, costRange[1]])
  }

  function handleMaxInput(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value === '' ? MAX_COST : Number(e.target.value)
    const v = Math.max(costRange[0], Math.min(raw, MAX_COST))
    setCostRange([costRange[0], v])
  }

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await fetch(`/api/restaurants/${restaurant.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          notes: notes || null,
          cost_min: costRange[0] === 0 ? null : costRange[0],
          cost_max: costRange[1] === MAX_COST ? null : costRange[1],
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

  const costLabel =
    costRange[0] === 0 && costRange[1] === MAX_COST
      ? '未设定'
      : costRange[0] === 0
      ? `≤ $${costRange[1]}`
      : costRange[1] === MAX_COST
      ? `≥ $${costRange[0]}`
      : `$${costRange[0]} – $${costRange[1]}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(31,28,24,0.4)', backdropFilter: 'blur(2px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative rounded-xl overflow-hidden flex flex-col"
        style={{
          width: 620,
          maxWidth: '95vw',
          maxHeight: '90vh',
          background: 'var(--fm-paper)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
          color: 'var(--fm-ink)',
          fontFamily: 'var(--font-geist-sans)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '24px 32px 0' }}>
          <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '1rem', color: 'var(--fm-ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            编辑地图钉
          </div>
          <div style={{ fontFamily: 'var(--font-instrument-serif)', fontSize: 28, lineHeight: 1, marginBottom: 20 }}>
            {restaurant.name}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto" style={{ padding: '0 32px 28px' }}>

          {/* Name */}
          <FormSection label="名称">
            <FmInput value={name} onChange={(e) => setName(e.target.value)} placeholder="餐馆名称 *" />
          </FormSection>

          {/* Address (read-only) */}
          {restaurant.address && (
            <p style={{ fontSize: '1rem', color: 'var(--fm-ink-3)', fontFamily: 'var(--font-geist-mono)', marginBottom: 14 }}>
              {restaurant.address}{restaurant.postal_code ? ` · ${restaurant.postal_code}` : ''}
            </p>
          )}

          {/* Cuisine */}
          <FormSection label="菜系">
            <TagInput type="cuisine" allTags={allTags} selectedIds={cuisineTagIds} onChange={setCuisineTagIds} onTagCreated={(t) => setAllTags((prev) => [...prev, t])} />
          </FormSection>

          {/* Dish */}
          <FormSection label="招牌菜品">
            <TagInput type="dish" allTags={allTags} selectedIds={dishTagIds} onChange={setDishTagIds} onTagCreated={(t) => setAllTags((prev) => [...prev, t])} />
          </FormSection>

          {/* Taste */}
          <FormSection label="口味">
            <TagInput type="taste" allTags={allTags} selectedIds={tasteTagIds} onChange={setTasteTagIds} onTagCreated={(t) => setAllTags((prev) => [...prev, t])} />
          </FormSection>

          {/* Scene */}
          <FormSection label="场合">
            <TagInput type="scene" allTags={allTags} selectedIds={sceneTagIds} onChange={setSceneTagIds} onTagCreated={(t) => setAllTags((prev) => [...prev, t])} />
          </FormSection>

          {/* Cost */}
          <FormSection label="人均消费 (S$)">
            <div style={{ paddingLeft: 4, paddingRight: 4, paddingBottom: 6 }}>
              <Slider value={costRange} min={0} max={MAX_COST} step={5} onValueChange={handleCostSlider} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '1rem', color: 'var(--fm-ink-3)' }}>$</span>
              <CostInput
                value={costRange[0] === 0 ? '' : String(costRange[0])}
                onChange={handleMinInput}
                placeholder="最少"
              />
              <span style={{ color: 'var(--fm-ink-3)' }}>–</span>
              <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '1rem', color: 'var(--fm-ink-3)' }}>$</span>
              <CostInput
                value={costRange[1] === MAX_COST ? '' : String(costRange[1])}
                onChange={handleMaxInput}
                placeholder="不限"
              />
              <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '1rem', color: 'var(--fm-ink-4)', marginLeft: 4 }}>
                {costLabel}
              </span>
            </div>
          </FormSection>

          {/* Notes */}
          <FormSection label="笔记">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="推荐菜品、特别提示、下次记得…"
              style={{
                width: '100%', minHeight: 72, borderRadius: 8,
                border: '1px solid var(--fm-line-2)', background: 'var(--fm-paper)',
                padding: '10px 12px', fontSize: '1rem', fontFamily: 'var(--font-geist-sans)',
                color: 'var(--fm-ink)', resize: 'none', outline: 'none', fontStyle: 'italic',
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
                padding: '10px 16px', borderRadius: 8, fontSize: '1rem', fontWeight: 500,
                border: '1px solid var(--fm-line-2)', background: 'transparent',
                color: 'var(--fm-ink-2)', cursor: 'pointer', fontFamily: 'var(--font-geist-sans)',
              }}
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              style={{
                padding: '10px 18px', borderRadius: 8, fontSize: '1rem', fontWeight: 500,
                background: saving || !name.trim() ? 'var(--fm-ink-4)' : 'var(--fm-orange)',
                borderColor: saving || !name.trim() ? 'var(--fm-ink-4)' : 'var(--fm-orange)',
                border: '1px solid',
                color: '#fff', cursor: saving || !name.trim() ? 'default' : 'pointer',
                fontFamily: 'var(--font-geist-sans)',
                boxShadow: '0 4px 10px rgba(217,107,44,0.25)',
              }}
            >
              {saving ? '保存中…' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function FmInput({ value, onChange, placeholder }: {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
}) {
  return (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        width: '100%', background: 'var(--fm-paper)', border: '1px solid var(--fm-line-2)',
        borderRadius: 8, padding: '10px 12px', fontSize: '1rem',
        fontFamily: 'var(--font-geist-sans)', color: 'var(--fm-ink)', outline: 'none',
      }}
      onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--fm-ink)')}
      onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--fm-line-2)')}
    />
  )
}

function CostInput({ value, onChange, placeholder }: {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      min={0}
      max={200}
      style={{
        width: 64, background: 'var(--fm-paper)', border: '1px solid var(--fm-line-2)',
        borderRadius: 6, padding: '5px 8px', fontSize: '1rem',
        fontFamily: 'var(--font-geist-mono)', color: 'var(--fm-ink)', outline: 'none',
        textAlign: 'center',
      }}
      onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--fm-ink)')}
      onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--fm-line-2)')}
    />
  )
}

function FormSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <p style={{
        fontFamily: 'var(--font-geist-mono)', fontSize: '1rem', letterSpacing: '0.06em',
        textTransform: 'uppercase', color: 'var(--fm-ink-3)', fontWeight: 600, marginBottom: 8,
      }}>
        {label}
      </p>
      {children}
    </div>
  )
}
