'use client'

import { useState, useRef } from 'react'
import type { Tag, TagType } from '@/lib/types'

interface Props {
  type: TagType
  allTags: Tag[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  onTagCreated: (tag: Tag) => void
}

const TYPE_LABELS: Record<TagType, string> = {
  cuisine: '菜系',
  dish: '菜品',
  taste: '口味',
  scene: '场合',
}

const TYPE_TAG_CLASS: Record<TagType, string> = {
  cuisine: 'fm-tag-cuisine',
  dish: 'fm-tag-dish',
  taste: 'fm-tag-taste',
  scene: 'fm-tag-scene',
}

export default function TagInput({ type, allTags, selectedIds, onChange, onTagCreated }: Props) {
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const label = TYPE_LABELS[type]
  const tagClass = TYPE_TAG_CLASS[type]

  const filtered = allTags.filter(
    (t) => t.type === type && t.name.toLowerCase().includes(search.toLowerCase())
  )

  const selectedTags = allTags.filter((t) => selectedIds.includes(t.id))

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((i) => i !== id) : [...selectedIds, id])
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

  const exactMatch = allTags.some(
    (t) => t.type === type && t.name.toLowerCase() === search.toLowerCase()
  )

  const available = allTags.filter((t) => t.type === type && !selectedIds.includes(t.id))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Selected */}
      {selectedTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {selectedTags.map((t) => (
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

      {/* Search input */}
      <input
        ref={inputRef}
        placeholder={`搜索或输入新${label}…`}
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
          fontSize: 12,
          fontFamily: 'var(--font-geist-sans)',
          color: 'var(--fm-ink)',
          outline: 'none',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--fm-ink)')}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--fm-line-2)')}
      />

      {/* Results */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 80, overflowY: 'auto' }}>
        {(search ? filtered : available).map((t) => (
          <button
            key={t.id}
            onClick={() => { toggle(t.id); setSearch('') }}
            className="fm-tag"
            style={{
              cursor: 'pointer',
              border: '1px dashed var(--fm-line-2)',
              background: 'transparent',
              color: 'var(--fm-ink-3)',
            }}
          >
            + {t.name}
          </button>
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
