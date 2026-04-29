'use client'

import { useState, useRef } from 'react'
import type { Tag, TagType } from '@/lib/types'
import { CUISINE_COLORS, CUISINE_BG } from '@/lib/constants'

interface Props {
  type: TagType
  allTags: Tag[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  onTagCreated: (tag: Tag) => void
  onTagDeleted?: (tagId: string) => void
  canManage?: boolean
  presets?: string[]
  subPresets?: string[]
}

const TYPE_LABELS: Record<TagType, string> = {
  cuisine: '菜系',
  dish: '种类 / 菜品',
  taste: '口味',
  scene: '场合',
}

const TYPE_TAG_CLASS: Record<TagType, string> = {
  cuisine: 'fm-tag-cuisine',
  dish: 'fm-tag-dish',
  taste: 'fm-tag-taste',
  scene: 'fm-tag-scene',
}

export default function TagInput({
  type,
  allTags,
  selectedIds,
  onChange,
  onTagCreated,
  onTagDeleted,
  canManage,
  presets,
  subPresets,
}: Props) {
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const label = TYPE_LABELS[type]
  const tagClass = TYPE_TAG_CLASS[type]
  const allPresetNames = [...(presets ?? []), ...(subPresets ?? [])]

  // Exclude preset-named tags from the search/available results (shown as chips instead)
  const filtered = allTags.filter(
    (t) =>
      t.type === type &&
      t.name.toLowerCase().includes(search.toLowerCase()) &&
      !allPresetNames.includes(t.name)
  )

  const selectedTags = allTags.filter((t) => selectedIds.includes(t.id))

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((i) => i !== id) : [...selectedIds, id])
  }

  function isPresetSelected(name: string): boolean {
    const tag = allTags.find((t) => t.type === type && t.name === name)
    return tag ? selectedIds.includes(tag.id) : false
  }

  async function togglePreset(name: string) {
    const existing = allTags.find((t) => t.type === type && t.name === name)
    if (existing) {
      toggle(existing.id)
      return
    }
    if (creating) return
    setCreating(true)
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type }),
      })
      const tag: Tag = await res.json()
      onTagCreated(tag)
      onChange([...selectedIds, tag.id])
    } finally {
      setCreating(false)
    }
  }

  async function createTag() {
    const name = search.trim()
    if (!name) return
    setCreating(true)
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type }),
      })
      const tag: Tag = await res.json()
      onTagCreated(tag)
      onChange([...selectedIds, tag.id])
      setSearch('')
    } finally {
      setCreating(false)
    }
  }

  async function deleteTag(tag: Tag) {
    if (!confirm(`删除标签「${tag.name}」？此操作会从所有餐馆中移除该标签。`)) return
    setDeletingId(tag.id)
    try {
      await fetch(`/api/tags/${tag.id}`, { method: 'DELETE' })
      onChange(selectedIds.filter((id) => id !== tag.id))
      onTagDeleted?.(tag.id)
    } finally {
      setDeletingId(null)
    }
  }

  const exactMatch = allTags.some(
    (t) => t.type === type && t.name.toLowerCase() === search.toLowerCase()
  )

  // Non-preset available tags (only shown in results, not as chips)
  const available = allTags.filter(
    (t) => t.type === type && !selectedIds.includes(t.id) && !allPresetNames.includes(t.name)
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* ── Preset chips ── */}
      {presets && presets.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {presets.map((name) => {
            const active = isPresetSelected(name)
            if (type === 'cuisine') {
              const fg = CUISINE_COLORS[name] ?? 'var(--fm-ink-2)'
              const bg = CUISINE_BG[name] ?? 'var(--fm-muted)'
              return (
                <button
                  key={name}
                  onClick={() => togglePreset(name)}
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
            }
            return (
              <button
                key={name}
                onClick={() => togglePreset(name)}
                className={`fm-chip${active ? ' active' : ''}`}
                style={{ fontSize: 12.5 }}
              >
                {name}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Sub-preset chips (e.g. Chinese sub-cuisines) ── */}
      {subPresets && subPresets.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingLeft: 2 }}>
          {subPresets.map((name) => {
            const active = isPresetSelected(name)
            if (type === 'cuisine') {
              const fg = CUISINE_COLORS[name] ?? 'var(--fm-ink-2)'
              const bg = CUISINE_BG[name] ?? 'var(--fm-muted)'
              return (
                <button
                  key={name}
                  onClick={() => togglePreset(name)}
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
            }
            return (
              <button
                key={name}
                onClick={() => togglePreset(name)}
                className={`fm-chip${active ? ' active' : ''}`}
                style={{ fontSize: 11.5 }}
              >
                {name}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Selected non-preset tags ── */}
      {selectedTags.filter((t) => !allPresetNames.includes(t.name)).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {selectedTags
            .filter((t) => !allPresetNames.includes(t.name))
            .map((t) => (
              <button
                key={t.id}
                onClick={() => toggle(t.id)}
                className={`fm-tag ${tagClass}`}
                style={{ cursor: 'pointer' }}
              >
                {t.name} <span style={{ opacity: 0.6 }}>✕</span>
              </button>
            ))}
        </div>
      )}

      {/* ── Search / custom input ── */}
      <input
        ref={inputRef}
        placeholder={`自定义${label}…`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            if (!exactMatch && search.trim()) createTag()
            else if (filtered.length === 1) { toggle(filtered[0].id); setSearch('') }
          }
        }}
        style={{
          width: '100%',
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

      {/* ── Custom tag results ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 80, overflowY: 'auto' }}>
        {(search ? filtered : available).map((t) => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <button
              onClick={() => { toggle(t.id); setSearch('') }}
              className="fm-tag"
              style={{
                cursor: 'pointer',
                border: '1px dashed var(--fm-line-2)',
                background: 'transparent',
                color: 'var(--fm-ink-3)',
                borderRadius: canManage ? '6px 0 0 6px' : undefined,
              }}
            >
              + {t.name}
            </button>
            {canManage && (
              <button
                onClick={(e) => { e.stopPropagation(); deleteTag(t) }}
                disabled={deletingId === t.id}
                title="删除此标签"
                style={{
                  height: '100%',
                  padding: '0 5px',
                  border: '1px dashed var(--fm-line-2)',
                  borderLeft: 'none',
                  borderRadius: '0 6px 6px 0',
                  background: 'transparent',
                  color: 'var(--fm-ink-4)',
                  cursor: 'pointer',
                  fontSize: 10,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            )}
          </div>
        ))}
        {search && !exactMatch && search.trim() && (
          <button
            onClick={createTag}
            className="fm-tag"
            style={{
              cursor: 'pointer',
              border: '1px dashed var(--fm-orange)',
              background: 'transparent',
              color: 'var(--fm-orange-dark)',
            }}
          >
            {creating ? '创建中…' : `+ 新建 "${search.trim()}"`}
          </button>
        )}
      </div>
    </div>
  )
}
