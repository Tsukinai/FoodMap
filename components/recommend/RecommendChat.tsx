'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { signIn } from '@/lib/auth'
import FeedbackPanel from './FeedbackPanel'
import type { User } from '@supabase/supabase-js'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

type Stage = 'understanding' | 'searching' | 'writing' | null
type ModelStatus = 'checking' | 'ok' | 'error'
type Vote = 'up' | 'down'

interface Props {
  user: User | null
  isOwner?: boolean
  onClose: () => void
  onHighlight: (ids: string[]) => void
  onClearHighlight: () => void
  highlightCount: number | null
}

const STAGE_TEXT: Record<Exclude<Stage, null>, string> = {
  understanding: '理解你的需求…',
  searching: '在你的地图里搜寻…',
  writing: '正在生成推荐…',
}

export default function RecommendChat({ user, isOwner, onClose, onHighlight, onClearHighlight, highlightCount }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [stage, setStage] = useState<Stage>(null)
  const [modelStatus, setModelStatus] = useState<ModelStatus>('checking')
  const [votes, setVotes] = useState<Record<number, Vote>>({})
  const [feedbackIdx, setFeedbackIdx] = useState<number | null>(null)
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackPanelOpen, setFeedbackPanelOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (user) inputRef.current?.focus()
  }, [user])

  useEffect(() => {
    fetch('/api/llm-health')
      .then(r => r.json())
      .then(d => setModelStatus(d.ok ? 'ok' : 'error'))
      .catch(() => setModelStatus('error'))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, stage])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: ChatMessage = { role: 'user', content: text }
    const nextMessages = [...messages, userMsg]
    setMessages([...nextMessages, { role: 'assistant', content: '' }])
    setInput('')
    setLoading(true)
    setStage('understanding')

    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      })

      if (!res.ok || !res.body) throw new Error('request failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'stage') {
              setStage(data.stage as Stage)
            } else if (data.type === 'meta') {
              onHighlight(data.restaurant_ids)
            } else if (data.type === 'delta' && data.content) {
              setStage(null)
              setMessages(prev => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last?.role === 'assistant') {
                  updated[updated.length - 1] = { ...last, content: last.content + data.content }
                }
                return updated
              })
            } else if (data.type === 'error') {
              setStage(null)
              setMessages(prev => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last?.role === 'assistant' && last.content === '') {
                  updated[updated.length - 1] = { ...last, content: data.message ?? '请求失败，请稍后重试。' }
                }
                return updated
              })
            }
          } catch { /* skip malformed chunk */ }
        }
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        if (last?.role === 'assistant' && last.content === '') {
          updated[updated.length - 1] = { ...last, content: '请求失败，请检查网络后重试。' }
        }
        return updated
      })
    } finally {
      setLoading(false)
      setStage(null)
    }
  }, [input, loading, messages, onHighlight])

  function handleClear() {
    setMessages([])
    setVotes({})
    setFeedbackIdx(null)
    setFeedbackText('')
    onClearHighlight()
  }

  function handleVote(idx: number, vote: Vote) {
    if (votes[idx]) return
    setVotes(prev => ({ ...prev, [idx]: vote }))
    if (vote === 'down') {
      setFeedbackIdx(idx)
      setFeedbackText('')
    } else {
      setFeedbackIdx(null)
    }
  }

  async function submitFeedback(idx: number) {
    const payload = { msg_content: messages[idx]?.content ?? null, feedback_text: feedbackText || null }
    setFeedbackIdx(null)
    setFeedbackText('')
    await fetch('/api/llm-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  }

  const canSend = modelStatus === 'ok' && !loading && !!input.trim() && !!user

  return (
    <>
    {feedbackPanelOpen && <FeedbackPanel onClose={() => setFeedbackPanelOpen(false)} />}
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--fm-paper)',
        borderLeft: '1px solid var(--fm-line)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '12px 14px',
          borderBottom: '1px solid var(--fm-line)',
          gap: 8,
          flexShrink: 0,
          minHeight: 48,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--fm-orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
        </svg>
        <span style={{ fontFamily: 'var(--font-geist-sans)', fontWeight: 600, fontSize: 13.5, color: 'var(--fm-ink)' }}>
          AI 推荐
        </span>

        {/* Model status indicator */}
        <span
          title={
            modelStatus === 'checking' ? '检测模型中…' :
            modelStatus === 'ok' ? '模型在线' : '模型离线'
          }
          style={{
            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
            background:
              modelStatus === 'checking' ? 'var(--fm-ink-4)' :
              modelStatus === 'ok' ? 'var(--fm-green)' : '#dc2626',
            ...(modelStatus === 'checking' ? { animation: 'fm-pulse 1.4s ease-in-out infinite' } : {}),
          }}
        />

        {highlightCount !== null && (
          <button
            onClick={onClearHighlight}
            title="清除高亮"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '2px 8px', borderRadius: 99,
              background: 'var(--fm-cream)',
              border: '1px solid var(--fm-line)',
              cursor: 'pointer',
              fontSize: 11, fontFamily: 'var(--font-geist-mono)',
              color: 'var(--fm-ink-2)',
            }}
          >
            <span style={{ color: 'var(--fm-orange)', fontWeight: 600 }}>{highlightCount}</span>
            <span>家</span>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
        <div style={{ flex: 1 }} />
        {isOwner && (
          <button
            onClick={() => setFeedbackPanelOpen(true)}
            style={{
              fontSize: 11.5, fontFamily: 'var(--font-geist-sans)',
              color: 'var(--fm-ink-3)', background: 'transparent',
              border: 'none', cursor: 'pointer',
              padding: '2px 6px', borderRadius: 6,
            }}
          >
            查看反馈
          </button>
        )}
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            disabled={loading}
            style={{
              fontSize: 11.5, fontFamily: 'var(--font-geist-sans)',
              color: 'var(--fm-ink-3)', background: 'transparent',
              border: 'none', cursor: loading ? 'default' : 'pointer',
              padding: '2px 6px', borderRadius: 6,
              opacity: loading ? 0.4 : 1,
            }}
          >
            清空
          </button>
        )}
        <button
          onClick={onClose}
          title="收起"
          style={{
            width: 26, height: 26, borderRadius: 8, border: 'none',
            background: 'var(--fm-cream)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--fm-ink-3)',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="13 17 18 12 13 7"/>
            <polyline points="6 17 11 12 6 7"/>
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '14px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {!user && (
          <div style={{ margin: 'auto', textAlign: 'center', padding: '24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 13, color: 'var(--fm-ink-3)', fontFamily: 'var(--font-geist-sans)', lineHeight: 1.7 }}>
              登录后可以使用 AI 推荐
              <br />
              <span style={{ fontSize: 12, color: 'var(--fm-ink-4)' }}>
                用一句话描述想吃什么，AI 帮你在地图里找
              </span>
            </div>
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

        {user && modelStatus === 'error' && messages.length === 0 && (
          <div style={{ margin: 'auto', textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 13, color: '#dc2626', fontFamily: 'var(--font-geist-sans)', lineHeight: 1.7 }}>
              模型离线，无法使用 AI 推荐
              <br />
              <span style={{ fontSize: 12, color: 'var(--fm-ink-4)' }}>请检查 Ollama 服务是否运行</span>
            </div>
          </div>
        )}

        {user && modelStatus !== 'error' && messages.length === 0 && (
          <div style={{ margin: 'auto', textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 13, color: 'var(--fm-ink-3)', fontFamily: 'var(--font-geist-sans)', lineHeight: 1.7 }}>
              用一句话描述你想吃什么
              <br />
              <span style={{ fontSize: 12, color: 'var(--fm-ink-4)' }}>
                &ldquo;Clementi 附近想吃中餐&rdquo;<br />
                &ldquo;便宜的辣的，还没去过的&rdquo;
              </span>
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const isLastAssistant = msg.role === 'assistant' && i === messages.length - 1
          const showStage = isLastAssistant && msg.content === '' && stage !== null
          const showThinking = isLastAssistant && msg.content === '' && loading && stage === null
          const isCompletedAssistant = msg.role === 'assistant' && msg.content !== '' && !(isLastAssistant && loading)

          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 4 }}>
              <div
                style={{
                  maxWidth: '88%',
                  padding: '8px 12px',
                  borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: msg.role === 'user' ? 'var(--fm-orange)' : 'var(--fm-cream)',
                  color: msg.role === 'user' ? '#fff' : 'var(--fm-ink)',
                  fontSize: 13.5,
                  lineHeight: 1.6,
                  fontFamily: 'var(--font-geist-sans)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {showStage ? (
                  <StageIndicator text={STAGE_TEXT[stage!]} />
                ) : showThinking ? (
                  <LoadingDots />
                ) : (
                  msg.content
                )}
              </div>

              {/* Feedback row — only for completed assistant messages */}
              {isCompletedAssistant && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <VoteButton
                      type="up"
                      active={votes[i] === 'up'}
                      disabled={!!votes[i]}
                      onClick={() => handleVote(i, 'up')}
                    />
                    <VoteButton
                      type="down"
                      active={votes[i] === 'down'}
                      disabled={!!votes[i]}
                      onClick={() => handleVote(i, 'down')}
                    />
                  </div>

                  {/* Inline feedback dialog */}
                  {feedbackIdx === i && (
                    <div
                      style={{
                        background: 'var(--fm-cream)',
                        border: '1px solid var(--fm-line-2)',
                        borderRadius: 10,
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        width: 220,
                      }}
                    >
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--fm-ink-3)', fontFamily: 'var(--font-geist-sans)' }}>
                        哪里不满意？（可选）
                      </p>
                      <textarea
                        value={feedbackText}
                        onChange={e => setFeedbackText(e.target.value)}
                        placeholder="说说看…"
                        autoFocus
                        style={{
                          width: '100%',
                          minHeight: 64,
                          resize: 'none',
                          borderRadius: 7,
                          border: '1px solid var(--fm-line-2)',
                          background: 'var(--fm-paper)',
                          padding: '7px 9px',
                          fontSize: 12.5,
                          fontFamily: 'var(--font-geist-sans)',
                          color: 'var(--fm-ink)',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                        onFocus={e => (e.currentTarget.style.borderColor = 'var(--fm-ink)')}
                        onBlur={e => (e.currentTarget.style.borderColor = 'var(--fm-line-2)')}
                      />
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => { setFeedbackIdx(null); setFeedbackText('') }}
                          style={{
                            padding: '5px 10px', borderRadius: 7, fontSize: 12,
                            border: '1px solid var(--fm-line-2)', background: 'transparent',
                            color: 'var(--fm-ink-3)', cursor: 'pointer',
                            fontFamily: 'var(--font-geist-sans)',
                          }}
                        >
                          跳过
                        </button>
                        <button
                          onClick={() => submitFeedback(i)}
                          style={{
                            padding: '5px 10px', borderRadius: 7, fontSize: 12,
                            border: 'none', background: 'var(--fm-ink)',
                            color: 'var(--fm-paper)', cursor: 'pointer',
                            fontFamily: 'var(--font-geist-sans)', fontWeight: 500,
                          }}
                        >
                          提交
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        style={{
          padding: '10px 12px',
          borderTop: '1px solid var(--fm-line)',
          display: 'flex',
          gap: 8,
          flexShrink: 0,
          background: 'var(--fm-paper)',
        }}
      >
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder={!user ? '登录后可用' : modelStatus === 'error' ? '模型离线' : '想吃什么？'}
          disabled={loading || !user || modelStatus === 'error'}
          style={{
            flex: 1,
            height: 36,
            padding: '0 12px',
            borderRadius: 10,
            border: '1px solid var(--fm-line-2)',
            background: 'var(--fm-cream)',
            fontSize: 13.5,
            fontFamily: 'var(--font-geist-sans)',
            color: 'var(--fm-ink)',
            outline: 'none',
          }}
        />
        <button
          onClick={send}
          disabled={!canSend}
          style={{
            width: 36, height: 36, borderRadius: 10, border: 'none',
            background: canSend ? 'var(--fm-orange)' : 'var(--fm-line)',
            color: '#fff', cursor: canSend ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, transition: 'background 0.12s',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
    </>
  )
}

function VoteButton({ type, active, disabled, onClick }: {
  type: 'up' | 'down'
  active: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={type === 'up' ? '有用' : '没用'}
      style={{
        width: 26, height: 26,
        borderRadius: 7,
        border: `1px solid ${active ? (type === 'up' ? 'var(--fm-green)' : '#dc2626') : 'var(--fm-line-2)'}`,
        background: active ? (type === 'up' ? '#eaf4ee' : '#fee2e2') : 'transparent',
        color: active ? (type === 'up' ? 'var(--fm-green)' : '#dc2626') : 'var(--fm-ink-4)',
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: disabled && !active ? 0.4 : 1,
        transition: 'all 0.1s',
        padding: 0,
        flexShrink: 0,
      }}
    >
      {type === 'up' ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
          <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/>
          <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
        </svg>
      )}
    </button>
  )
}

function LoadingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', height: 20 }}>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          style={{
            width: 5, height: 5, borderRadius: '50%',
            background: 'var(--fm-ink-3)',
            animation: `fm-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </span>
  )
}

function StageIndicator({ text }: { text: string }) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        fontFamily: 'var(--font-geist-sans)',
        fontSize: 13, color: 'var(--fm-ink-3)',
      }}
    >
      <span
        style={{
          width: 12, height: 12, borderRadius: '50%',
          border: '1.5px solid var(--fm-line-2)',
          borderTopColor: 'var(--fm-orange)',
          animation: 'fm-spin 0.8s linear infinite',
          flexShrink: 0,
        }}
      />
      <span style={{ animation: 'fm-pulse 1.4s ease-in-out infinite' }}>{text}</span>
    </span>
  )
}
