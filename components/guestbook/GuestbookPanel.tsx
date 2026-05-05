'use client'

import { useState, useEffect, useCallback } from 'react'
import { signIn } from '@/lib/auth'
import type { User } from '@supabase/supabase-js'

interface Message {
  id: string
  user_id: string
  author_name: string
  author_avatar: string | null
  content: string
  reply: string | null
  replied_at: string | null
  created_at: string
}

interface Props {
  user: User | null
  isOwner: boolean
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function GuestbookPanel({ user, isOwner }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [replyingId, setReplyingId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replySubmitting, setReplySubmitting] = useState(false)

  const fetchMessages = useCallback(async () => {
    const res = await fetch('/api/messages')
    const data = await res.json()
    setMessages(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchMessages() }, [fetchMessages])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim() || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() }),
      })
      if (res.ok) {
        setContent('')
        await fetchMessages()
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/messages/${id}`, { method: 'DELETE' })
    if (res.ok) setMessages(prev => prev.filter(m => m.id !== id))
  }

  async function handleReply(id: string) {
    if (!replyText.trim() || replySubmitting) return
    setReplySubmitting(true)
    try {
      const res = await fetch(`/api/messages/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply: replyText.trim() }),
      })
      if (res.ok) {
        const updated = await res.json()
        setMessages(prev => prev.map(m => m.id === id ? updated : m))
        setReplyingId(null)
        setReplyText('')
      }
    } finally {
      setReplySubmitting(false)
    }
  }

  async function handleDeleteReply(id: string) {
    const res = await fetch(`/api/messages/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: '' }),
    })
    if (res.ok) {
      const updated = await res.json()
      setMessages(prev => prev.map(m => m.id === id ? updated : m))
    }
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--fm-paper)', color: 'var(--fm-ink)' }}>
      {/* Post form */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--fm-line)', flexShrink: 0 }}>
        {user ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              {user.user_metadata?.avatar_url && (
                <img
                  src={user.user_metadata.avatar_url}
                  alt=""
                  style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }}
                />
              )}
              <span style={{ fontSize: 13, color: 'var(--fm-ink-3)', fontFamily: 'var(--font-geist-mono)' }}>
                {user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email}
              </span>
            </div>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="留下你的建议或餐馆推荐…"
              rows={3}
              style={{
                width: '100%',
                background: 'var(--fm-cream)',
                border: '1.5px solid var(--fm-line-2)',
                borderRadius: 8,
                padding: '8px 10px',
                fontSize: 13,
                fontFamily: 'var(--font-geist-sans)',
                color: 'var(--fm-ink)',
                resize: 'none',
                outline: 'none',
                lineHeight: 1.5,
              }}
            />
            <button
              type="submit"
              disabled={!content.trim() || submitting}
              style={{
                alignSelf: 'flex-end',
                padding: '6px 16px',
                borderRadius: 8,
                border: 'none',
                background: content.trim() ? 'var(--fm-orange)' : 'var(--fm-muted)',
                color: content.trim() ? '#fff' : 'var(--fm-ink-4)',
                fontSize: 13,
                fontFamily: 'var(--font-geist-sans)',
                fontWeight: 500,
                cursor: content.trim() ? 'pointer' : 'default',
                transition: 'background 0.15s',
              }}
            >
              {submitting ? '发送中…' : '发送'}
            </button>
          </form>
        ) : (
          <div className="flex flex-col gap-2 items-start">
            <span style={{ fontSize: 13, color: 'var(--fm-ink-3)', fontFamily: 'var(--font-geist-sans)' }}>
              登录后可以留言
            </span>
            <button
              onClick={signIn}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: '1.5px solid var(--fm-line-2)',
                background: 'var(--fm-paper)',
                color: 'var(--fm-ink-2)',
                fontSize: 13,
                fontFamily: 'var(--font-geist-sans)',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Google 登录
            </button>
          </div>
        )}
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '12px 20px 20px' }}>
        {loading ? (
          <div style={{ color: 'var(--fm-ink-4)', fontSize: 13, fontFamily: 'var(--font-geist-mono)', paddingTop: 16 }}>
            加载中…
          </div>
        ) : messages.length === 0 ? (
          <div style={{ color: 'var(--fm-ink-4)', fontSize: 13, fontFamily: 'var(--font-geist-mono)', paddingTop: 16 }}>
            还没有留言，来第一个吧
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map(msg => (
              <div
                key={msg.id}
                style={{
                  background: 'var(--fm-cream)',
                  borderRadius: 10,
                  padding: '12px 14px',
                  border: '1px solid var(--fm-line)',
                }}
              >
                {/* Author row */}
                <div className="flex items-center justify-between gap-2" style={{ marginBottom: 8 }}>
                  <div className="flex items-center gap-2">
                    {msg.author_avatar ? (
                      <img
                        src={msg.author_avatar}
                        alt=""
                        style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0 }}
                      />
                    ) : (
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                        background: 'var(--fm-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, color: 'var(--fm-ink-3)',
                      }}>
                        {msg.author_name[0]?.toUpperCase()}
                      </div>
                    )}
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fm-ink-2)', fontFamily: 'var(--font-geist-sans)' }}>
                      {msg.author_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 11, color: 'var(--fm-ink-4)', fontFamily: 'var(--font-geist-mono)' }}>
                      {formatDate(msg.created_at)}
                    </span>
                    {isOwner && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setReplyingId(replyingId === msg.id ? null : msg.id)
                            setReplyText(msg.reply ?? '')
                          }}
                          style={{
                            fontSize: 11, color: 'var(--fm-ink-3)', background: 'none', border: 'none',
                            cursor: 'pointer', padding: '2px 6px', borderRadius: 4,
                            fontFamily: 'var(--font-geist-mono)',
                          }}
                        >
                          回复
                        </button>
                        <button
                          onClick={() => handleDelete(msg.id)}
                          style={{
                            fontSize: 11, color: 'var(--fm-error)', background: 'none', border: 'none',
                            cursor: 'pointer', padding: '2px 6px', borderRadius: 4,
                            fontFamily: 'var(--font-geist-mono)',
                          }}
                        >
                          删除
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Content */}
                <p style={{ fontSize: 13.5, color: 'var(--fm-ink)', lineHeight: 1.55, margin: 0, fontFamily: 'var(--font-geist-sans)', whiteSpace: 'pre-wrap' }}>
                  {msg.content}
                </p>

                {/* Reply */}
                {msg.reply && (
                  <div style={{
                    marginTop: 10,
                    padding: '8px 10px',
                    background: 'var(--fm-paper)',
                    borderRadius: 7,
                    borderLeft: '3px solid var(--fm-orange)',
                  }}>
                    <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fm-orange)', fontFamily: 'var(--font-geist-mono)' }}>
                        作者回复
                      </span>
                      {isOwner && (
                        <button
                          onClick={() => handleDeleteReply(msg.id)}
                          style={{
                            fontSize: 11, color: 'var(--fm-ink-4)', background: 'none', border: 'none',
                            cursor: 'pointer', padding: '1px 4px', fontFamily: 'var(--font-geist-mono)',
                          }}
                        >
                          删除回复
                        </button>
                      )}
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--fm-ink-2)', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-geist-sans)' }}>
                      {msg.reply}
                    </p>
                  </div>
                )}

                {/* Reply input (owner only) */}
                {isOwner && replyingId === msg.id && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <textarea
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      placeholder="输入回复…"
                      rows={2}
                      style={{
                        width: '100%',
                        background: 'var(--fm-paper)',
                        border: '1.5px solid var(--fm-line-2)',
                        borderRadius: 7,
                        padding: '6px 8px',
                        fontSize: 13,
                        fontFamily: 'var(--font-geist-sans)',
                        color: 'var(--fm-ink)',
                        resize: 'none',
                        outline: 'none',
                        lineHeight: 1.5,
                      }}
                    />
                    <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => { setReplyingId(null); setReplyText('') }}
                        style={{
                          padding: '4px 10px', borderRadius: 6, border: '1px solid var(--fm-line-2)',
                          background: 'none', color: 'var(--fm-ink-3)', fontSize: 12,
                          fontFamily: 'var(--font-geist-mono)', cursor: 'pointer',
                        }}
                      >
                        取消
                      </button>
                      <button
                        onClick={() => handleReply(msg.id)}
                        disabled={!replyText.trim() || replySubmitting}
                        style={{
                          padding: '4px 10px', borderRadius: 6, border: 'none',
                          background: replyText.trim() ? 'var(--fm-orange)' : 'var(--fm-muted)',
                          color: replyText.trim() ? '#fff' : 'var(--fm-ink-4)',
                          fontSize: 12, fontFamily: 'var(--font-geist-mono)', cursor: replyText.trim() ? 'pointer' : 'default',
                        }}
                      >
                        {replySubmitting ? '提交中…' : '提交回复'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
