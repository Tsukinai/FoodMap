'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Tag, TagType } from '@/lib/types'

const SECTIONS: { type: TagType; label: string; accent: string; bg: string; supportsChildren: boolean }[] = [
  { type: 'cuisine', label: '菜系', accent: 'var(--fm-orange)',  bg: 'var(--fm-tag-cuisine)', supportsChildren: true },
  { type: 'dish',    label: '种类', accent: 'var(--fm-green)',   bg: 'var(--fm-tag-dish)',    supportsChildren: false },
  { type: 'taste',   label: '口味', accent: 'var(--fm-gold)',    bg: 'var(--fm-tag-taste)',   supportsChildren: false },
  { type: 'scene',   label: '场合', accent: 'var(--fm-plum)',    bg: 'var(--fm-tag-scene)',   supportsChildren: false },
]

interface AddingState {
  type: TagType
  parentId: string | null
}

function makeTmpId() {
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function getGroupKey(t: Tag) {
  return `${t.type}::${t.parent_id ?? ''}`
}

function computeIsDirty(current: Tag[], saved: Tag[]): boolean {
  if (current.some(t => t.id.startsWith('tmp-'))) return true
  if (current.length !== saved.length) return true
  const savedMap = new Map(saved.map(t => [t.id, t]))
  if (current.some(t => { const s = savedMap.get(t.id); return !s || s.name !== t.name })) return true
  // Check order within each group
  const byGroup = new Map<string, { curr: string[]; saved: string[] }>()
  for (const t of current) {
    const key = getGroupKey(t)
    const entry = byGroup.get(key) ?? { curr: [], saved: [] }
    entry.curr.push(t.id)
    byGroup.set(key, entry)
  }
  for (const t of saved) {
    const key = getGroupKey(t)
    const entry = byGroup.get(key) ?? { curr: [], saved: [] }
    entry.saved.push(t.id)
    byGroup.set(key, entry)
  }
  for (const { curr, saved: sav } of byGroup.values()) {
    if (curr.join(',') !== sav.join(',')) return true
  }
  return false
}

export default function TagsManager({ initialTags }: { initialTags: Tag[] }) {
  const router = useRouter()
  const [tags, setTags] = useState<Tag[]>(initialTags)
  const savedTagsRef = useRef<Tag[]>(initialTags)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [adding, setAdding] = useState<AddingState | null>(null)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const editRef = useRef<HTMLInputElement>(null)
  const addRef = useRef<HTMLInputElement>(null)

  const isDirty = computeIsDirty(tags, savedTagsRef.current)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } })
  )

  useEffect(() => { editRef.current?.focus() }, [editingId])
  useEffect(() => { addRef.current?.focus() }, [adding])

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  function handleBackClick() {
    if (isDirty && !confirm('有未保存的更改，确认放弃并返回？')) return
    router.push('/')
  }

  function handleDiscard() {
    if (!confirm('放弃所有未保存的更改？')) return
    setTags(savedTagsRef.current)
    setEditingId(null)
    setAdding(null)
    setNewName('')
    setSaveError(null)
  }

  function startEdit(tag: Tag) {
    setAdding(null)
    setEditingId(tag.id)
    setEditingName(tag.name)
  }

  function commitRename(tag: Tag) {
    const trimmed = editingName.trim()
    setEditingId(null)
    if (!trimmed || trimmed === tag.name) return
    setTags(prev => prev.map(t => t.id === tag.id ? { ...t, name: trimmed } : t))
  }

  function handleDelete(id: string) {
    const isTmp = id.startsWith('tmp-')
    if (!isTmp && !confirm('确认删除此标签？保存后关联餐厅的该标签也会移除。')) return
    setTags(prev => prev.filter(t => t.id !== id && t.parent_id !== id))
  }

  function commitAdd(type: TagType, parentId: string | null) {
    const trimmed = newName.trim()
    setAdding(null)
    setNewName('')
    if (!trimmed) return
    const id = makeTmpId()
    const newTag: Tag = {
      id,
      name: trimmed,
      type,
      parent_id: parentId,
      sort_order: tags.filter(t => t.type === type && t.parent_id === parentId).length,
      created_at: new Date().toISOString(),
    }
    setTags(prev => [...prev, newTag])
  }

  function makeDragHandler(type: TagType, parentId: string | null, groupTags: Tag[]) {
    return (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const oldIndex = groupTags.findIndex(t => t.id === active.id)
      const newIndex = groupTags.findIndex(t => t.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return
      const reordered = arrayMove(groupTags, oldIndex, newIndex)
      setTags(prev => [
        ...prev.filter(t => !(t.type === type && t.parent_id === parentId)),
        ...reordered,
      ])
    }
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      const saved = savedTagsRef.current

      // 1. Delete removed saved tags
      const deletedIds = saved
        .filter(st => !tags.find(t => t.id === st.id))
        .map(t => t.id)
      await Promise.all(deletedIds.map(id =>
        fetch(`/api/tags/${id}`, { method: 'DELETE' })
      ))

      // 2. Create new tags (top-level first, then children with tmp parents)
      const tmpToReal = new Map<string, string>()
      const created = tags.filter(t => t.id.startsWith('tmp-'))
      const topLevelNew = created.filter(t => !t.parent_id?.startsWith('tmp-'))
      const childNew = created.filter(t => t.parent_id?.startsWith('tmp-'))

      for (const tag of topLevelNew) {
        const res = await fetch('/api/tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: tag.name, type: tag.type, parent_id: tag.parent_id }),
        })
        if (res.ok) {
          const t: Tag = await res.json()
          tmpToReal.set(tag.id, t.id)
        }
      }

      for (const tag of childNew) {
        const realParentId = tmpToReal.get(tag.parent_id!) ?? tag.parent_id
        const res = await fetch('/api/tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: tag.name, type: tag.type, parent_id: realParentId }),
        })
        if (res.ok) {
          const t: Tag = await res.json()
          tmpToReal.set(tag.id, t.id)
        }
      }

      // 3. Rename changed tags
      const renamedTags = tags.filter(t =>
        !t.id.startsWith('tmp-') &&
        saved.find(st => st.id === t.id && st.name !== t.name)
      )
      await Promise.all(renamedTags.map(tag =>
        fetch(`/api/tags/${tag.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: tag.name }),
        })
      ))

      // 4. Build final tag list with real IDs
      const finalTags = tags.map(t => ({
        ...t,
        id: tmpToReal.get(t.id) ?? t.id,
        parent_id: t.parent_id ? (tmpToReal.get(t.parent_id) ?? t.parent_id) : null,
      }))

      // 5. Reorder each group
      const groups = new Map<string, string[]>()
      for (const t of finalTags) {
        const key = getGroupKey(t)
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key)!.push(t.id)
      }
      await Promise.all([...groups.values()].map(ids =>
        fetch('/api/tags/reorder', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        })
      ))

      setTags(finalTags)
      savedTagsRef.current = finalTags
    } catch {
      setSaveError('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ height: '100vh', overflowY: 'auto', background: 'var(--fm-cream)', color: 'var(--fm-ink)', fontFamily: 'var(--font-geist-sans)' }}>
      {/* Header */}
      <header
        style={{
          borderBottom: '1px solid var(--fm-line)',
          background: 'var(--fm-paper)',
          padding: '0 24px',
          height: 56,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <button
          onClick={handleBackClick}
          style={{ fontSize: 13, color: 'var(--fm-ink-3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          ← 返回地图
        </button>
        <span style={{ color: 'var(--fm-line-2)' }}>|</span>
        <span style={{ fontSize: 15, fontWeight: 600 }}>标签管理</span>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {saveError && (
            <span style={{ fontSize: 12, color: 'var(--fm-error)' }}>{saveError}</span>
          )}
          {isDirty && !saving && (
            <button
              onClick={handleDiscard}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: '1px solid var(--fm-line-2)',
                background: 'transparent',
                color: 'var(--fm-ink-3)',
                fontSize: 12.5,
                cursor: 'pointer',
              }}
            >
              放弃更改
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            style={{
              padding: '5px 14px',
              borderRadius: 6,
              border: 'none',
              background: isDirty ? 'var(--fm-orange)' : 'var(--fm-line)',
              color: isDirty ? '#fff' : 'var(--fm-ink-4)',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: isDirty && !saving ? 'pointer' : 'default',
              transition: 'background 0.15s',
              minWidth: 56,
            }}
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px' }}>
        {isDirty && (
          <div style={{
            marginBottom: 20,
            padding: '8px 14px',
            borderRadius: 8,
            background: 'rgba(var(--fm-orange-rgb, 230, 126, 34), 0.08)',
            border: '1px solid var(--fm-orange)',
            fontSize: 12.5,
            color: 'var(--fm-ink-2)',
          }}>
            有未保存的更改 — 点击右上角"保存"持久化，或"放弃更改"撤销。
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {SECTIONS.map(({ type, label, accent, bg, supportsChildren }) => {
            const sectionTags = tags.filter(t => t.type === type)
            const topLevel = sectionTags.filter(t => !t.parent_id)
            const subByParent = sectionTags.reduce<Record<string, Tag[]>>((acc, t) => {
              if (t.parent_id) {
                acc[t.parent_id] = [...(acc[t.parent_id] ?? []), t]
              }
              return acc
            }, {})

            return (
              <section key={type}>
                {/* Section header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 4, height: 16, borderRadius: 2, background: accent, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>
                    <span style={{ fontSize: 11, color: 'var(--fm-ink-4)', fontFamily: 'var(--font-geist-mono)' }}>
                      {sectionTags.length}
                    </span>
                  </div>
                  <AddBtn accent={accent} busy={saving} onClick={() => { setAdding({ type, parentId: null }); setNewName('') }} />
                </div>

                {/* Tag box */}
                <div
                  style={{
                    padding: 16,
                    background: 'var(--fm-paper)',
                    borderRadius: 12,
                    border: '1px solid var(--fm-line)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  {/* Top-level tags */}
                  <DndContext
                    id={`dnd-${type}-top`}
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={makeDragHandler(type, null, topLevel)}
                  >
                    <SortableContext items={topLevel.map(t => t.id)} strategy={rectSortingStrategy}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, minHeight: 32 }}>
                        {topLevel.length === 0 && adding?.type !== type && (
                          <span style={{ fontSize: 12.5, color: 'var(--fm-ink-4)' }}>暂无标签</span>
                        )}
                        {topLevel.map(tag => (
                          <SortableTagChip
                            key={tag.id}
                            tag={tag}
                            bg={bg}
                            editingId={editingId}
                            editingName={editingName}
                            editRef={editRef}
                            busy={saving}
                            onEdit={startEdit}
                            onEditNameChange={setEditingName}
                            onRename={commitRename}
                            onCancelEdit={() => setEditingId(null)}
                            onDelete={handleDelete}
                          />
                        ))}
                        {adding?.type === type && adding.parentId === null && (
                          <InlineAddInput
                            ref={addRef}
                            value={newName}
                            onChange={setNewName}
                            accent={accent}
                            onCommit={() => commitAdd(type, null)}
                            onCancel={() => { setAdding(null); setNewName('') }}
                          />
                        )}
                      </div>
                    </SortableContext>
                  </DndContext>

                  {/* Sub-tag rows */}
                  {supportsChildren && topLevel.map(parent => {
                    const children = subByParent[parent.id] ?? []
                    const isAddingHere = adding?.type === type && adding.parentId === parent.id
                    if (children.length === 0 && !isAddingHere) return null
                    return (
                      <div key={parent.id} style={{ paddingLeft: 12, borderLeft: `2px solid ${accent}`, opacity: 0.85 }}>
                        <span style={{ fontSize: 11, color: 'var(--fm-ink-4)', display: 'block', marginBottom: 6 }}>
                          {parent.name} 子类
                        </span>
                        <DndContext
                          id={`dnd-${type}-${parent.id}`}
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={makeDragHandler(type, parent.id, children)}
                        >
                          <SortableContext items={children.map(t => t.id)} strategy={rectSortingStrategy}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {children.map(tag => (
                                <SortableTagChip
                                  key={tag.id}
                                  tag={tag}
                                  bg={bg}
                                  small
                                  editingId={editingId}
                                  editingName={editingName}
                                  editRef={editRef}
                                  busy={saving}
                                  onEdit={startEdit}
                                  onEditNameChange={setEditingName}
                                  onRename={commitRename}
                                  onCancelEdit={() => setEditingId(null)}
                                  onDelete={handleDelete}
                                />
                              ))}
                              {isAddingHere && (
                                <InlineAddInput
                                  ref={addRef}
                                  value={newName}
                                  onChange={setNewName}
                                  accent={accent}
                                  onCommit={() => commitAdd(type, parent.id)}
                                  onCancel={() => { setAdding(null); setNewName('') }}
                                />
                              )}
                            </div>
                          </SortableContext>
                        </DndContext>
                      </div>
                    )
                  })}

                  {/* "Add sub-tag" buttons */}
                  {supportsChildren && topLevel.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, borderTop: '1px dashed var(--fm-line)', paddingTop: 10 }}>
                      {topLevel.map(parent => (
                        <button
                          key={parent.id}
                          onClick={() => { setAdding({ type, parentId: parent.id }); setNewName('') }}
                          disabled={saving}
                          style={{
                            padding: '3px 8px',
                            borderRadius: 6,
                            border: `1px dashed ${accent}`,
                            background: 'transparent',
                            color: accent,
                            fontSize: 11.5,
                            cursor: 'pointer',
                            opacity: saving ? 0.5 : 1,
                          }}
                        >
                          + {parent.name} 子类
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <p style={{ marginTop: 6, fontSize: 11, color: 'var(--fm-ink-4)' }}>
                  拖动排序 · 点击名称重命名 · × 删除
                </p>
              </section>
            )
          })}
        </div>
      </main>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AddBtn({ accent, busy, onClick }: { accent: string; busy: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      style={{
        padding: '4px 10px',
        borderRadius: 6,
        border: `1.5px solid ${accent}`,
        background: 'transparent',
        color: accent,
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
        opacity: busy ? 0.5 : 1,
      }}
    >
      + 添加
    </button>
  )
}

interface TagChipProps {
  tag: Tag
  bg: string
  small?: boolean
  editingId: string | null
  editingName: string
  editRef: React.RefObject<HTMLInputElement | null>
  busy: boolean
  onEdit: (tag: Tag) => void
  onEditNameChange: (name: string) => void
  onRename: (tag: Tag) => void
  onCancelEdit: () => void
  onDelete: (id: string) => void
}

function SortableTagChip(props: TagChipProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.tag.id })
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'manipulation',
      }}
      {...attributes}
      {...listeners}
    >
      <TagChip {...props} />
    </div>
  )
}

function TagChip({
  tag, bg, small = false, editingId, editingName, editRef, busy,
  onEdit, onEditNameChange, onRename, onCancelEdit, onDelete,
}: TagChipProps) {
  const isEditing = editingId === tag.id
  const isTmp = tag.id.startsWith('tmp-')
  const pad = small ? '3px 7px' : '5px 8px'
  const fontSize = small ? 11.5 : 12.5

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        borderRadius: 8,
        background: bg,
        border: isTmp ? '1px dashed var(--fm-line-2)' : '1px solid var(--fm-line)',
        overflow: 'hidden',
      }}
    >
      {isEditing ? (
        <input
          ref={editRef}
          value={editingName}
          onChange={e => onEditNameChange(e.target.value)}
          onBlur={() => onRename(tag)}
          onKeyDown={e => {
            if (e.key === 'Enter') onRename(tag)
            if (e.key === 'Escape') onCancelEdit()
          }}
          style={{
            padding: pad,
            fontSize,
            fontFamily: 'var(--font-geist-sans)',
            border: 'none',
            background: 'transparent',
            color: 'var(--fm-ink)',
            outline: 'none',
            minWidth: 50,
            width: `${Math.max(editingName.length * 14, 50)}px`,
          }}
        />
      ) : (
        <button
          onClick={() => onEdit(tag)}
          title="点击重命名"
          style={{
            padding: pad,
            fontSize,
            fontWeight: 500,
            background: 'transparent',
            border: 'none',
            color: isTmp ? 'var(--fm-ink-3)' : 'var(--fm-ink-2)',
            cursor: 'text',
          }}
        >
          {tag.name}
        </button>
      )}
      <button
        onClick={() => onDelete(tag.id)}
        disabled={busy}
        title="删除"
        style={{
          width: 22,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: 'none',
          borderLeft: '1px solid var(--fm-line)',
          color: 'var(--fm-ink-4)',
          cursor: 'pointer',
          fontSize: 12,
          flexShrink: 0,
        }}
        className="fm-delete-btn"
      >
        ×
      </button>
    </div>
  )
}

const InlineAddInput = React.forwardRef<HTMLInputElement, {
  value: string
  onChange: (v: string) => void
  accent: string
  onCommit: () => void
  onCancel: () => void
}>(function InlineAddInput({ value, onChange, accent, onCommit, onCancel }, ref) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        borderRadius: 8,
        border: `1.5px solid ${accent}`,
        background: 'var(--fm-cream)',
        overflow: 'hidden',
      }}
    >
      <input
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={e => {
          if (e.key === 'Enter') onCommit()
          if (e.key === 'Escape') onCancel()
        }}
        placeholder="新标签名…"
        style={{
          padding: '4px 10px',
          fontSize: 12.5,
          fontFamily: 'var(--font-geist-sans)',
          border: 'none',
          background: 'transparent',
          color: 'var(--fm-ink)',
          outline: 'none',
          width: 120,
        }}
      />
    </div>
  )
})
