'use client'

import { useState, useEffect, useCallback } from 'react'

interface FeedbackEntry {
  id: string
  user_id: string
  msg_content: string | null
  feedback_text: string | null
  created_at: string
}

interface Props {
  onClose: () => void
}

export default function FeedbackPanel({ onClose }: Props) {
  const [entries, setEntries] = useState<FeedbackEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchFeedback = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/llm-feedback')
      const data = await res.json()
      setEntries(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchFeedback() }, [fetchFeedback])

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await fetch('/api/llm-feedback', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      setEntries(prev => prev.filter(e => e.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(31,28,24,0.4)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          width: 480, maxWidth: '100vw', height: '100%',
          background: 'var(--fm-paper)',
          borderLeft: '1px solid var(--fm-line)',
          display: 'flex', flexDirection: 'column',
          boxShadow: '-12px 0 40px rgba(0,0,0,0.12)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '16px 20px',
            borderBottom: '1px solid var(--fm-line)',
            flexShrink: 0,
          }}
        >
          <span style={{ fontFamily: 'var(--font-geist-sans)', fontWeight: 600, fontSize: 14, color: 'var(--fm-ink)', flex: 1 }}>
            AI 回答反馈
          </span>
          <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 11, color: 'var(--fm-ink-4)' }}>
            {entries.length} 条
          </span>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 8, border: 'none',
              background: 'var(--fm-cream)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--fm-ink-3)',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {loading && (
            <div style={{ fontSize: 13, color: 'var(--fm-ink-4)', fontFamily: 'var(--font-geist-mono)', margin: 'auto' }}>
              加载中…
            </div>
          )}
          {!loading && entries.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--fm-ink-4)', fontFamily: 'var(--font-geist-sans)', margin: 'auto', textAlign: 'center' }}>
              暂无反馈
            </div>
          )}
          {entries.map(entry => (
            <div
              key={entry.id}
              style={{
                borderRadius: 10,
                border: '1px solid var(--fm-line-2)',
                background: 'var(--fm-cream)',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {entry.msg_content && (
                <div>
                  <p style={{ margin: '0 0 4px', fontFamily: 'var(--font-geist-mono)', fontSize: 10, color: 'var(--fm-ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    AI 回答
                  </p>
                  <p style={{ margin: 0, fontSize: 12.5, color: 'var(--fm-ink-2)', fontFamily: 'var(--font-geist-sans)', lineHeight: 1.5, whiteSpace: 'pre-wrap', maxHeight: 100, overflow: 'hidden', position: 'relative' }}>
                    {entry.msg_content.length > 200 ? entry.msg_content.slice(0, 200) + '…' : entry.msg_content}
                  </p>
                </div>
              )}
              {entry.feedback_text && (
                <div>
                  <p style={{ margin: '0 0 4px', fontFamily: 'var(--font-geist-mono)', fontSize: 10, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    用户反馈
                  </p>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--fm-ink)', fontFamily: 'var(--font-geist-sans)', lineHeight: 1.5 }}>
                    {entry.feedback_text}
                  </p>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10.5, color: 'var(--fm-ink-4)' }}>
                  {new Date(entry.created_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
                <button
                  onClick={() => handleDelete(entry.id)}
                  disabled={deletingId === entry.id}
                  style={{
                    fontSize: 11.5, fontFamily: 'var(--font-geist-sans)',
                    color: 'var(--fm-ink-4)', background: 'transparent',
                    border: 'none', cursor: deletingId === entry.id ? 'default' : 'pointer',
                    padding: '2px 6px', borderRadius: 6,
                    opacity: deletingId === entry.id ? 0.4 : 1,
                  }}
                  onMouseEnter={e => { if (!deletingId) e.currentTarget.style.color = '#dc2626' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--fm-ink-4)' }}
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
