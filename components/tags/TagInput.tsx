'use client'

import { useState, useRef } from 'react'
import type { Tag, TagType } from '@/lib/types'
import { CUISINE_STYLES } from '@/lib/constants'

interface Props {
  type: TagType
  allTags: Tag[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  onTagCreated: (tag: Tag) => void
  onTagDeleted?: (tagId: string) => void
  canManage?: boolean
}

const TYPE_LABELS: Record<TagType, string> = {
  cuisine: '菜系',
  dish: '种类 / 菜品',
  taste: '口味',
  scene: '场合',
}

export default function TagInput({
  type,
  allTags,
  selectedIds,
  onChange,
  onTagCreated,
  onTagDeleted,
  canManage,
}: Props) {
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pendingCreate, setPendingCreate] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const typeTags = allTags.filter((t) => t.type === type)
  const topLevel = typeTags.filter((t) => !t.parent_id)
  const subTags = typeTags.filter((t) => t.parent_id)

  // Build children map for accordion
  const childrenByParent = new Map<string, Tag[]>()
  subTags.forEach(tag => {
    if (!tag.parent_id) return
    const list = childrenByParent.get(tag.parent_id) ?? []
    list.push(tag)
    childrenByParent.set(tag.parent_id, list)
  })

  // Pre-expand parents that already have a selected child (edit mode)
  const [expandedParents, setExpandedParents] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    subTags.forEach(tag => {
      if (tag.parent_id && selectedIds.includes(tag.id)) initial.add(tag.parent_id)
    })
    return initial
  })

  function toggleExpand(id: string) {
    setExpandedParents(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((i) => i !== id))
      return
    }
    const tag = typeTags.find((t) => t.id === id)
    let newIds = [...selectedIds, id]
    // sub-tag auto-selects its parent
    if (tag?.parent_id && !newIds.includes(tag.parent_id)) {
      newIds = [...newIds, tag.parent_id]
    }
    onChange(newIds)
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
      if (!res.ok) return
      const tag: Tag = await res.json()
      onTagCreated(tag)
      onChange([...selectedIds, tag.id])
      setSearch('')
      setPendingCreate(false)
    } finally {
      setCreating(false)
    }
  }

  async function deleteTag(tagId: string) {
    setDeletingId(tagId)
    setConfirmDeleteId(null)
    try {
      const res = await fetch(`/api/tags/${tagId}`, { method: 'DELETE' })
      if (!res.ok) return
      onChange(selectedIds.filter((id) => id !== tagId))
      onTagDeleted?.(tagId)
    } finally {
      setDeletingId(null)
    }
  }

  const exactMatch = typeTags.some(
    (t) => t.name.toLowerCase() === search.toLowerCase()
  )

  const filtered = search
    ? typeTags.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()) && !selectedIds.includes(t.id))
    : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Top-level chips */}
      {topLevel.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {topLevel.map((tag) => {
              const active = selectedIds.includes(tag.id)
              const children = childrenByParent.get(tag.id) ?? []
              const isExpanded = expandedParents.has(tag.id)
              if (type === 'cuisine') {
                const { color: fg, bg } = CUISINE_STYLES[tag.name] ?? { color: 'var(--fm-ink-2)', bg: 'var(--fm-muted)' }
                return (
                  <div key={tag.id} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <button
                      onClick={() => toggle(tag.id)}
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
                          width: 18,
                          height: 18,
                          borderRadius: 4,
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          color: 'var(--fm-ink-4)',
                          fontSize: 9,
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
              }
              return (
                <button
                  key={tag.id}
                  onClick={() => toggle(tag.id)}
                  className={`fm-chip${active ? ' active' : ''}`}
                  style={{ fontSize: 12.5 }}
                >
                  {tag.name}
                </button>
              )
            })}
          </div>

          {/* Expanded sub-cuisine panels */}
          {type === 'cuisine' && topLevel
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
                    const childActive = selectedIds.includes(child.id)
                    const childFg = CUISINE_STYLES[child.name]?.color ?? parentFg
                    const childBg = CUISINE_STYLES[child.name]?.bg ?? 'var(--fm-muted)'
                    return (
                      <button
                        key={child.id}
                        onClick={() => toggle(child.id)}
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
      )}

      {/* Search / custom input */}
      <input
        ref={inputRef}
        placeholder={`自定义${TYPE_LABELS[type]}…`}
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPendingCreate(false) }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            if (pendingCreate) { createTag(); return }
            if (!exactMatch && search.trim()) setPendingCreate(true)
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

      {/* Custom tag results */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 80, overflowY: 'auto' }}>
        {filtered.map((t) => (
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
            {canManage && confirmDeleteId !== t.id && (
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(t.id) }}
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
            {canManage && confirmDeleteId === t.id && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 2 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteTag(t.id) }}
                  style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, border: '1px solid var(--fm-orange)', background: 'transparent', color: 'var(--fm-orange-dark)', cursor: 'pointer' }}
                >
                  删除
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null) }}
                  style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, border: '1px solid var(--fm-line-2)', background: 'transparent', color: 'var(--fm-ink-4)', cursor: 'pointer' }}
                >
                  取消
                </button>
              </div>
            )}
          </div>
        ))}
        {search && !exactMatch && search.trim() && !pendingCreate && (
          <button
            onClick={() => setPendingCreate(true)}
            className="fm-tag"
            style={{
              cursor: 'pointer',
              border: '1px dashed var(--fm-orange)',
              background: 'transparent',
              color: 'var(--fm-orange-dark)',
            }}
          >
            {`+ 新建 "${search.trim()}"`}
          </button>
        )}
        {search && !exactMatch && search.trim() && pendingCreate && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {type === 'dish' && (
              <p style={{ margin: 0, fontSize: 11.5, color: 'var(--fm-ink-3)', lineHeight: 1.5 }}>
                如果是招牌菜，请在「招牌菜」字段填写，而不是新建标签。
              </p>
            )}
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={createTag}
                disabled={creating}
                style={{ fontSize: 12, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--fm-orange)', background: 'transparent', color: 'var(--fm-orange-dark)', cursor: 'pointer' }}
              >
                {creating ? '创建中…' : `新建「${search.trim()}」`}
              </button>
              <button
                onClick={() => setPendingCreate(false)}
                style={{ fontSize: 12, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--fm-line-2)', background: 'transparent', color: 'var(--fm-ink-4)', cursor: 'pointer' }}
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
