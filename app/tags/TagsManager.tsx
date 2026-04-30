'use client'

import React, { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  DndContext,
  closestCenter,
  PointerSensor,
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

export default function TagsManager({ initialTags }: { initialTags: Tag[] }) {
  const [tags, setTags] = useState<Tag[]>(initialTags)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [adding, setAdding] = useState<AddingState | null>(null)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const editRef = useRef<HTMLInputElement>(null)
  const addRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  useEffect(() => { editRef.current?.focus() }, [editingId])
  useEffect(() => { addRef.current?.focus() }, [adding])

  function startEdit(tag: Tag) {
    setAdding(null)
    setEditingId(tag.id)
    setEditingName(tag.name)
  }

  async function commitRename(tag: Tag) {
    const trimmed = editingName.trim()
    setEditingId(null)
    if (!trimmed || trimmed === tag.name) return
    setBusy(true)
    const res = await fetch(`/api/tags/${tag.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    })
    if (res.ok) {
      const updated: Tag = await res.json()
      setTags(prev => prev.map(t => t.id === tag.id ? updated : t))
    }
    setBusy(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('确认删除此标签？删除后所有关联餐厅的该标签也会移除。')) return
    setBusy(true)
    const res = await fetch(`/api/tags/${id}`, { method: 'DELETE' })
    if (res.ok) setTags(prev => prev.filter(t => t.id !== id))
    setBusy(false)
  }

  async function commitAdd(type: TagType, parentId: string | null) {
    const trimmed = newName.trim()
    setAdding(null)
    setNewName('')
    if (!trimmed) return
    setBusy(true)
    const res = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed, type, parent_id: parentId }),
    })
    if (res.ok) {
      const created: Tag = await res.json()
      setTags(prev => [...prev, created])
    }
    setBusy(false)
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
      fetch('/api/tags/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: reordered.map(t => t.id) }),
      })
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fm-cream)', color: 'var(--fm-ink)', fontFamily: 'var(--font-geist-sans)' }}>
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
        }}
      >
        <Link href="/" style={{ fontSize: 13, color: 'var(--fm-ink-3)', textDecoration: 'none' }}>
          ← 返回地图
        </Link>
        <span style={{ color: 'var(--fm-line-2)' }}>|</span>
        <span style={{ fontSize: 15, fontWeight: 600 }}>标签管理</span>
        {busy && <span style={{ fontSize: 12, color: 'var(--fm-ink-4)', marginLeft: 'auto' }}>保存中…</span>}
      </header>

      <main style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px' }}>
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
                  <AddBtn accent={accent} busy={busy} onClick={() => { setAdding({ type, parentId: null }); setNewName('') }} />
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
                            busy={busy}
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
                                  busy={busy}
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
                          disabled={busy}
                          style={{
                            padding: '3px 8px',
                            borderRadius: 6,
                            border: `1px dashed ${accent}`,
                            background: 'transparent',
                            color: accent,
                            fontSize: 11.5,
                            cursor: 'pointer',
                            opacity: busy ? 0.5 : 1,
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
        touchAction: 'none',
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
  const pad = small ? '3px 7px' : '5px 8px'
  const fontSize = small ? 11.5 : 12.5

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        borderRadius: 8,
        background: bg,
        border: '1px solid var(--fm-line)',
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
            color: 'var(--fm-ink-2)',
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
        onMouseEnter={e => (e.currentTarget.style.color = '#c0392b')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--fm-ink-4)')}
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
