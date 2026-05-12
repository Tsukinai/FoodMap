'use client'

import { useState, useEffect, useCallback } from 'react'
import type { PinRequest, Tag } from '@/lib/types'

interface Props {
  allTags: Tag[]
  onClose: () => void
  onChanged: () => void
}

export default function PinRequestsPanel({ allTags, onClose, onChanged }: Props) {
  const [requests, setRequests] = useState<PinRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)

  const tagById = new Map(allTags.map((t) => [t.id, t]))

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/pin-requests')
      const data = await res.json()
      setRequests(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  async function approve(id: string) {
    setActingId(id)
    try {
      await fetch(`/api/pin-requests/${id}/approve`, { method: 'POST' })
      setRequests((prev) => prev.filter((r) => r.id !== id))
      onChanged()
    } finally {
      setActingId(null)
    }
  }

  async function reject(id: string) {
    setActingId(id)
    try {
      await fetch(`/api/pin-requests/${id}`, { method: 'DELETE' })
      setRequests((prev) => prev.filter((r) => r.id !== id))
      onChanged()
    } finally {
      setActingId(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(31,28,24,0.4)', backdropFilter: 'blur(2px)' }}
    >
      <div
        className="relative rounded-xl overflow-hidden flex flex-col"
        style={{ width: 600, maxWidth: '95vw', maxHeight: '90vh', background: 'var(--fm-paper)', boxShadow: '0 24px 64px rgba(0,0,0,0.18)', color: 'var(--fm-ink)', fontFamily: 'var(--font-geist-sans)' }}
      >
        {/* Header */}
        <div style={{ padding: '24px 32px 16px', borderBottom: '1px solid var(--fm-line)', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10, color: 'var(--fm-ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 500, marginBottom: 6 }}>
              待审核
            </div>
            <div style={{ fontFamily: 'var(--font-instrument-serif)', fontSize: 28, lineHeight: 1 }}>
              餐馆推荐 {!loading && requests.length > 0 && <span style={{ fontSize: 18, color: 'var(--fm-orange)' }}>({requests.length})</span>}
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto" style={{ padding: '16px 32px 24px' }}>
          {loading ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--fm-ink-4)', fontFamily: 'var(--font-geist-mono)', fontSize: 13 }}>
              加载中…
            </div>
          ) : requests.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--fm-ink-4)', fontFamily: 'var(--font-geist-mono)', fontSize: 13 }}>
              暂无待审推荐
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {requests.map((req) => {
                const cuisineTags = req.cuisine_tag_ids.map((id) => tagById.get(id)).filter(Boolean) as Tag[]
                const sceneTags = req.scene_tag_ids.map((id) => tagById.get(id)).filter(Boolean) as Tag[]
                const acting = actingId === req.id

                return (
                  <div
                    key={req.id}
                    style={{ border: '1px solid var(--fm-line)', borderRadius: 12, padding: '16px 20px', background: 'var(--fm-cream)' }}
                  >
                    {/* Author */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      {req.author_avatar ? (
                        <img src={req.author_avatar} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--fm-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--fm-ink-3)' }}>
                          {req.author_name[0]}
                        </div>
                      )}
                      <span style={{ fontSize: 13, color: 'var(--fm-ink-3)', fontFamily: 'var(--font-geist-mono)' }}>
                        {req.author_name}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--fm-ink-4)', marginLeft: 'auto', fontFamily: 'var(--font-geist-mono)' }}>
                        {new Date(req.created_at).toLocaleDateString('zh-CN')}
                      </span>
                    </div>

                    {/* Restaurant info */}
                    <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{req.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--fm-ink-3)', marginBottom: 10 }}>{req.address}</div>

                    {/* Tags */}
                    {(cuisineTags.length > 0 || sceneTags.length > 0) && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                        {cuisineTags.map((t) => (
                          <span key={t.id} className="fm-tag">{t.name}</span>
                        ))}
                        {sceneTags.map((t) => (
                          <span key={t.id} className="fm-tag fm-tag-scene">{t.name}</span>
                        ))}
                      </div>
                    )}

                    {/* Notes */}
                    <div style={{ fontSize: 13.5, color: 'var(--fm-ink-2)', fontStyle: 'italic', lineHeight: 1.6, marginBottom: 14, borderLeft: '2px solid var(--fm-line)', paddingLeft: 10 }}>
                      {req.notes}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => approve(req.id)}
                        disabled={acting}
                        style={{ flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-geist-sans)', border: '1px solid var(--fm-green)', background: acting ? 'var(--fm-muted)' : '#eaf4ee', color: acting ? 'var(--fm-ink-4)' : 'var(--fm-green)', cursor: acting ? 'default' : 'pointer', transition: 'all 0.12s' }}
                      >
                        {acting ? '处理中…' : '通过，加入想吃'}
                      </button>
                      <button
                        onClick={() => reject(req.id)}
                        disabled={acting}
                        style={{ flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-geist-sans)', border: '1px solid var(--fm-line-2)', background: 'transparent', color: 'var(--fm-ink-3)', cursor: acting ? 'default' : 'pointer', transition: 'all 0.12s' }}
                      >
                        拒绝
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
