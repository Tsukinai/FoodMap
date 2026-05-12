'use client'

import { useState, useEffect } from 'react'
import type { Tag } from '@/lib/types'
import TagInput from '@/components/tags/TagInput'

interface Props {
  onClose: () => void
  onSubmitted: () => void
}

type PlaceResult = { name: string; address: string; postal_code: string; lat: number; lng: number }

export default function PinRequestModal({ onClose, onSubmitted }: Props) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [lng, setLng] = useState<number | null>(null)
  const [lat, setLat] = useState<number | null>(null)
  const [cuisineTagIds, setCuisineTagIds] = useState<string[]>([])
  const [sceneTagIds, setSceneTagIds] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [addressResults, setAddressResults] = useState<PlaceResult[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetch('/api/tags').then((r) => r.json()).then(setAllTags)
  }, [])

  async function searchByAddress() {
    if (address.trim().length < 2) return
    const res = await fetch(`/api/places?q=${encodeURIComponent(address.trim())}`)
    const data = await res.json()
    setAddressResults(Array.isArray(data) ? data : [])
  }

  function selectAddress(p: PlaceResult) {
    setName(p.name)
    setAddress(p.address)
    setPostalCode(p.postal_code)
    setLng(p.lng)
    setLat(p.lat)
    setAddressResults([])
  }

  const canSubmit = name.trim() && address.trim() && lng !== null && lat !== null &&
    cuisineTagIds.length > 0 && sceneTagIds.length > 0 && notes.trim()

  async function handleSubmit() {
    if (!canSubmit) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/pin-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          address,
          postal_code: postalCode || null,
          lng,
          lat,
          cuisine_tag_ids: cuisineTagIds,
          scene_tag_ids: sceneTagIds,
          notes: notes.trim(),
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? '提交失败，请重试')
        return
      }
      setSuccess(true)
      setTimeout(() => { onSubmitted(); onClose() }, 1200)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(31,28,24,0.4)', backdropFilter: 'blur(2px)' }}
    >
      <div
        className="relative rounded-xl overflow-hidden flex flex-col"
        style={{
          width: 560,
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10, color: 'var(--fm-ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 500, marginBottom: 6 }}>
                推荐餐馆
              </div>
              <div style={{ fontFamily: 'var(--font-instrument-serif)', fontSize: 28, lineHeight: 1, marginBottom: 18 }}>
                向店主推荐一家
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ flexShrink: 0, marginLeft: 12, width: 32, height: 32, borderRadius: 8, border: '1px solid var(--fm-line-2)', background: 'transparent', color: 'var(--fm-ink-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--fm-muted)'; e.currentTarget.style.color = 'var(--fm-ink)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--fm-ink-3)' }}
              aria-label="关闭"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto" style={{ padding: '0 32px 24px' }}>
          {success ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--fm-green)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
              <div style={{ fontSize: 14 }}>推荐已提交，等待店主审核</div>
            </div>
          ) : (
            <>
              {/* Address search */}
              <Section label="餐馆名称 + 地址" required>
                <div style={{ position: 'relative' }}>
                  <input
                    value={address}
                    onChange={(e) => { setAddress(e.target.value); setLng(null); setLat(null) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchByAddress() } }}
                    placeholder="输入餐馆名称或地址，回车搜索…"
                    style={inputStyle}
                    onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--fm-ink)')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--fm-line-2)')}
                  />
                  {addressResults.length > 0 && (
                    <div
                      className="absolute top-full left-0 right-0 z-10 rounded-lg overflow-hidden"
                      style={{ border: '1px solid var(--fm-line-2)', background: 'var(--fm-paper)', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', marginTop: 4, maxHeight: 200, overflowY: 'auto' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 6px 0' }}>
                        <button onClick={() => setAddressResults([])} style={{ fontSize: 11, color: 'var(--fm-ink-4)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>✕</button>
                      </div>
                      {addressResults.map((p, i) => (
                        <button
                          key={i}
                          className="fm-dropdown-item w-full text-left px-3 py-2.5"
                          style={{ color: 'var(--fm-ink-2)', borderBottom: '1px solid var(--fm-line)' }}
                          onClick={() => selectAddress(p)}
                        >
                          <div style={{ fontWeight: 500, fontSize: 14 }}>{p.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--fm-ink-4)', marginTop: 1 }}>{p.address}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {name && (
                  <div style={{ marginTop: 6, fontSize: 13, color: 'var(--fm-ink-2)', fontFamily: 'var(--font-geist-mono)' }}>
                    已选：{name}
                    {lat !== null && <span style={{ color: 'var(--fm-ink-4)', marginLeft: 6 }}>✓ 坐标已锁定</span>}
                  </div>
                )}
              </Section>

              {/* Cuisine */}
              <Section label="菜系" required>
                <TagInput
                  type="cuisine"
                  allTags={allTags}
                  selectedIds={cuisineTagIds}
                  onChange={setCuisineTagIds}
                  onTagCreated={() => {}}
                  canManage={false}
                />
              </Section>

              {/* Scene */}
              <Section label="场合" required>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {allTags.filter((t) => t.type === 'scene').map((tag) => {
                    const active = sceneTagIds.includes(tag.id)
                    return (
                      <button
                        key={tag.id}
                        onClick={() => setSceneTagIds((prev) => active ? prev.filter((i) => i !== tag.id) : [...prev, tag.id])}
                        className="fm-tag fm-tag-scene"
                        style={{ outline: active ? '1.5px solid #4a3d6b' : 'none', cursor: 'pointer' }}
                      >
                        {tag.name}
                      </button>
                    )
                  })}
                </div>
              </Section>

              {/* Notes */}
              <Section label="推荐理由" required>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="为什么推荐这家？哪道菜必点？有什么要提醒的？"
                  style={{ width: '100%', minHeight: 80, borderRadius: 8, border: '1px solid var(--fm-line-2)', background: 'var(--fm-paper)', padding: '10px 12px', fontSize: '1rem', fontFamily: 'var(--font-geist-sans)', color: 'var(--fm-ink)', resize: 'none', outline: 'none', fontStyle: 'italic' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--fm-ink)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--fm-line-2)')}
                />
              </Section>

              {error && (
                <div style={{ marginBottom: 12, fontSize: 13, color: '#dc2626', fontFamily: 'var(--font-geist-mono)' }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button
                  onClick={onClose}
                  style={{ padding: '10px 16px', borderRadius: 8, fontSize: 13.5, fontWeight: 500, border: '1px solid var(--fm-line-2)', background: 'transparent', color: 'var(--fm-ink-2)', cursor: 'pointer', fontFamily: 'var(--font-geist-sans)' }}
                >
                  取消
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={saving || !canSubmit}
                  style={{ padding: '10px 18px', borderRadius: 8, fontSize: 13.5, fontWeight: 500, border: 'none', background: saving || !canSubmit ? 'var(--fm-ink-4)' : 'var(--fm-orange)', color: '#fff', cursor: saving || !canSubmit ? 'default' : 'pointer', fontFamily: 'var(--font-geist-sans)' }}
                >
                  {saving ? '提交中…' : '提交推荐'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--fm-paper)',
  border: '1px solid var(--fm-line-2)',
  borderRadius: 8,
  padding: '12px 14px',
  fontSize: '1rem',
  fontFamily: 'var(--font-geist-sans)',
  color: 'var(--fm-ink)',
  outline: 'none',
}

function Section({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fm-ink-4)', fontWeight: 500, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
        {label}
        {required && <span style={{ color: 'var(--fm-orange)', fontSize: 13, fontWeight: 700, lineHeight: 1 }}>*</span>}
      </p>
      {children}
    </div>
  )
}
