'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { signIn } from '@/lib/auth'
import { AVAILABLE_MODELS, DEFAULT_MODEL, type AvailableModelId } from '@/lib/llm'
import type { User } from '@supabase/supabase-js'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

type Stage = 'understanding' | 'searching' | 'writing' | null

const MODEL_STORAGE_KEY = 'fm-recommend-model'

interface Props {
  user: User | null
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

export default function RecommendChat({ user, onClose, onHighlight, onClearHighlight, highlightCount }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [stage, setStage] = useState<Stage>(null)
  const [model, setModel] = useState<AvailableModelId>(DEFAULT_MODEL)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (user) inputRef.current?.focus()
  }, [user])

  useEffect(() => {
    const saved = localStorage.getItem(MODEL_STORAGE_KEY)
    if (saved && AVAILABLE_MODELS.some(m => m.id === saved)) {
      setModel(saved as AvailableModelId)
    }
  }, [])

  function changeModel(id: AvailableModelId) {
    setModel(id)
    localStorage.setItem(MODEL_STORAGE_KEY, id)
  }

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
        body: JSON.stringify({ messages: nextMessages, model }),
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
  }, [input, loading, messages, onHighlight, model])

  function handleClear() {
    setMessages([])
    onClearHighlight()
  }

  return (
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
        <select
          value={model}
          onChange={e => changeModel(e.target.value as AvailableModelId)}
          disabled={loading}
          title={AVAILABLE_MODELS.find(m => m.id === model)?.label}
          style={{
            height: 24, padding: '0 6px', borderRadius: 99,
            background: 'var(--fm-cream)',
            border: '1px solid var(--fm-line)',
            fontSize: 11, fontFamily: 'var(--font-geist-mono)',
            color: 'var(--fm-ink-2)',
            cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.4 : 1,
            outline: 'none',
            appearance: 'none',
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            paddingRight: 8,
          }}
        >
          {AVAILABLE_MODELS.map(m => (
            <option key={m.id} value={m.id}>{m.short}</option>
          ))}
        </select>
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

        {user && messages.length === 0 && (
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
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
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
          placeholder={user ? '想吃什么？' : '登录后可用'}
          disabled={loading || !user}
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
          disabled={loading || !input.trim() || !user}
          style={{
            width: 36, height: 36, borderRadius: 10, border: 'none',
            background: loading || !input.trim() || !user ? 'var(--fm-line)' : 'var(--fm-orange)',
            color: '#fff', cursor: loading || !input.trim() || !user ? 'default' : 'pointer',
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
