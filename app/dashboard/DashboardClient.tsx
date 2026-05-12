'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import type { PinRequest } from '@/lib/types'
import { RATING_ORDER } from '@/lib/types'
import { getRatingStyle } from '@/components/map/AddPinModal'
import type { DashboardStats } from '@/app/api/dashboard/stats/route'

interface FeedbackEntry {
  id: string
  user_id: string
  msg_content: string | null
  feedback_text: string | null
  created_at: string
}

const CARD: React.CSSProperties = {
  background: 'var(--fm-cream)',
  border: '1px solid var(--fm-line)',
  borderRadius: 12,
  padding: '20px 24px',
}

const SECTION_LABEL: React.CSSProperties = {
  fontFamily: 'var(--font-geist-mono)',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'var(--fm-ink-4)',
  marginBottom: 14,
}

const STAT_NUM: React.CSSProperties = {
  fontFamily: 'var(--font-instrument-serif)',
  fontSize: 36,
  lineHeight: 1,
  color: 'var(--fm-ink)',
}

function HBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ flex: 1, background: 'var(--fm-line)', borderRadius: 3, height: 6, overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(pct, 2)}%`, height: 6, borderRadius: 3, background: color, transition: 'width 0.4s ease' }} />
    </div>
  )
}

function Spinner() {
  return (
    <div style={{
      width: 16, height: 16, borderRadius: '50%',
      border: '2px solid var(--fm-line)',
      borderTopColor: 'var(--fm-orange)',
      animation: 'spin 0.7s linear infinite',
      display: 'inline-block',
    }} />
  )
}

type StatusFilter = 'all' | 'visited' | 'want'

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'visited', label: '已吃' },
  { value: 'want', label: '想去' },
]

export default function DashboardClient() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [aiSummary, setAiSummary] = useState('')
  const [aiStreaming, setAiStreaming] = useState(false)
  const [aiDone, setAiDone] = useState(false)
  const [pinRequests, setPinRequests] = useState<PinRequest[]>([])
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([])
  const [adminLoading, setAdminLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)

  const fetchStats = useCallback(async (filter: StatusFilter) => {
    setStatsLoading(true)
    try {
      const url = filter === 'all' ? '/api/dashboard/stats' : `/api/dashboard/stats?filter=${filter}`
      const res = await fetch(url)
      const data = await res.json()
      setStats(data)
    } catch {
      setStats(null)
    } finally {
      setStatsLoading(false)
    }
  }, [])

  const fetchAdmin = useCallback(async () => {
    try {
      const [prRes, fbRes] = await Promise.all([
        fetch('/api/pin-requests'),
        fetch('/api/llm-feedback'),
      ])
      const [prData, fbData] = await Promise.all([prRes.json(), fbRes.json()])
      setPinRequests(Array.isArray(prData) ? prData : [])
      setFeedback(Array.isArray(fbData) ? fbData : [])
    } catch {
      setPinRequests([])
      setFeedback([])
    } finally {
      setAdminLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats(statusFilter)
  }, [fetchStats, statusFilter])

  useEffect(() => {
    fetchAdmin()
  }, [fetchAdmin])

  const handleAiSummary = useCallback(async () => {
    if (!stats || aiStreaming || aiDone) return
    setAiStreaming(true)
    setAiSummary('')
    try {
      const res = await fetch('/api/dashboard/ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stats }),
      })
      if (!res.body) return
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const parts = buf.split('\n\n')
        buf = parts.pop() ?? ''
        for (const part of parts) {
          const line = part.startsWith('data: ') ? part.slice(6) : part
          if (!line.trim()) continue
          try {
            const json = JSON.parse(line)
            if (json.type === 'delta' && json.content) {
              setAiSummary(prev => prev + json.content)
            }
            if (json.type === 'done') {
              setAiDone(true)
            }
          } catch { /* skip */ }
        }
      }
    } catch {
      setAiSummary('分析失败，请稍后再试。')
    } finally {
      setAiStreaming(false)
      setAiDone(true)
    }
  }, [stats, aiStreaming, aiDone])

  const handleApprove = useCallback(async (id: string) => {
    setActingId(id)
    try {
      const res = await fetch(`/api/pin-requests/${id}/approve`, { method: 'POST' })
      if (res.ok) setPinRequests(prev => prev.filter(r => r.id !== id))
    } finally {
      setActingId(null)
    }
  }, [])

  const handleReject = useCallback(async (id: string) => {
    setActingId(id)
    try {
      const res = await fetch(`/api/pin-requests/${id}`, { method: 'DELETE' })
      if (res.ok) setPinRequests(prev => prev.filter(r => r.id !== id))
    } finally {
      setActingId(null)
    }
  }, [])

  const handleDeleteFeedback = useCallback(async (id: string) => {
    setActingId(id)
    try {
      const res = await fetch('/api/llm-feedback', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) setFeedback(prev => prev.filter(f => f.id !== id))
    } finally {
      setActingId(null)
    }
  }, [])

  const maxCuisine = stats ? Math.max(...stats.byCuisine.map(c => c.count), 1) : 1
  const maxArea = stats ? Math.max(...stats.byArea.map(a => a.count), 1) : 1
  const maxRating = stats ? Math.max(...stats.byRating.map(r => r.count), 1) : 1

  const costDisplay = stats
    ? stats.avgCostMin != null && stats.avgCostMax != null
      ? `$${stats.avgCostMin}–$${stats.avgCostMax}`
      : stats.avgCostMin != null
        ? `$${stats.avgCostMin}+`
        : '—'
    : '—'

  return (
    <div style={{ height: '100vh', overflowY: 'auto', background: 'var(--fm-paper)', fontFamily: 'var(--font-geist-sans)' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <header style={{
        height: 56,
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 24,
        paddingRight: 24,
        gap: 16,
        background: 'var(--fm-cream)',
        borderBottom: '1px solid var(--fm-line)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <Link href="/" style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: 'var(--fm-ink-3)',
          textDecoration: 'none',
          fontSize: 13,
          fontFamily: 'var(--font-geist-mono)',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          返回地图
        </Link>
        <div style={{ width: 1, height: 18, background: 'var(--fm-line)' }} />
        <div style={{ fontFamily: 'var(--font-instrument-serif)', fontSize: 20 }}>仪表盘</div>
        {stats && (
          <div style={{ color: 'var(--fm-ink-3)', fontSize: 12.5, fontFamily: 'var(--font-geist-mono)' }}>
            共 {stats.total} 家
          </div>
        )}
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 60px' }}>

        {/* A. Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
          {[
            { label: '总记录', value: stats?.total ?? '—', color: 'var(--fm-ink)' },
            { label: '已吃', value: stats?.visited ?? '—', color: 'var(--fm-green)' },
            { label: '想去', value: stats?.want ?? '—', color: 'var(--fm-orange)' },
            { label: '人均消费', value: statsLoading ? '—' : costDisplay, color: 'var(--fm-ink)' },
          ].map(({ label, value, color }) => (
            <div key={label} style={CARD}>
              <div style={SECTION_LABEL}>{label}</div>
              <div style={{ ...STAT_NUM, color }}>{statsLoading ? '—' : value}</div>
            </div>
          ))}
        </div>

        {/* Status filter toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
          <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 11, color: 'var(--fm-ink-4)', marginRight: 4 }}>查看分布</span>
          {STATUS_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              style={{
                height: 28, padding: '0 12px', borderRadius: 7,
                border: `1px solid ${statusFilter === value ? 'var(--fm-orange)' : 'var(--fm-line-2)'}`,
                background: statusFilter === value ? '#fdf0e6' : 'transparent',
                color: statusFilter === value ? 'var(--fm-orange-dark)' : 'var(--fm-ink-3)',
                fontSize: 12.5, fontFamily: 'var(--font-geist-sans)', fontWeight: statusFilter === value ? 600 : 400,
                cursor: 'pointer', transition: 'all 0.12s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* B. Rating + Area */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
          <div style={CARD}>
            <div style={SECTION_LABEL}>评分分布</div>
            {statsLoading ? (
              <div style={{ color: 'var(--fm-ink-4)', fontSize: 13 }}>加载中…</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {RATING_ORDER.map(rating => {
                  const entry = stats?.byRating.find(r => r.rating === rating)
                  const count = entry?.count ?? 0
                  const pct = (count / maxRating) * 100
                  const style = getRatingStyle(rating)
                  return (
                    <div key={rating} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 10, height: 10, borderRadius: '50%',
                        background: style.color, flexShrink: 0,
                      }} />
                      <div style={{ width: 52, fontSize: 12.5, color: 'var(--fm-ink-2)', flexShrink: 0 }}>{rating}</div>
                      <HBar pct={pct} color={style.color} />
                      <div style={{
                        width: 22, textAlign: 'right', fontSize: 12,
                        fontFamily: 'var(--font-geist-mono)', color: 'var(--fm-ink-3)', flexShrink: 0,
                      }}>{count}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div style={CARD}>
            <div style={SECTION_LABEL}>地区排行</div>
            {statsLoading ? (
              <div style={{ color: 'var(--fm-ink-4)', fontSize: 13 }}>加载中…</div>
            ) : stats?.byArea.length === 0 ? (
              <div style={{ color: 'var(--fm-ink-4)', fontSize: 13 }}>暂无数据</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {stats?.byArea.map(({ area, count }) => (
                  <div key={area} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 110, fontSize: 12.5, color: 'var(--fm-ink-2)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{area}</div>
                    <HBar pct={(count / maxArea) * 100} color="var(--fm-ink-3)" />
                    <div style={{
                      width: 22, textAlign: 'right', fontSize: 12,
                      fontFamily: 'var(--font-geist-mono)', color: 'var(--fm-ink-3)', flexShrink: 0,
                    }}>{count}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* C. Cuisine + Taste & Scene */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
          <div style={CARD}>
            <div style={SECTION_LABEL}>菜系排行</div>
            {statsLoading ? (
              <div style={{ color: 'var(--fm-ink-4)', fontSize: 13 }}>加载中…</div>
            ) : stats?.byCuisine.length === 0 ? (
              <div style={{ color: 'var(--fm-ink-4)', fontSize: 13 }}>暂无数据</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {stats?.byCuisine.map(({ name, count }) => (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 70, fontSize: 12.5, color: 'var(--fm-ink-2)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                    <HBar pct={(count / maxCuisine) * 100} color="#e8813a" />
                    <div style={{
                      width: 22, textAlign: 'right', fontSize: 12,
                      fontFamily: 'var(--font-geist-mono)', color: 'var(--fm-ink-3)', flexShrink: 0,
                    }}>{count}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={CARD}>
            <div style={SECTION_LABEL}>口味 &amp; 场合</div>
            {statsLoading ? (
              <div style={{ color: 'var(--fm-ink-4)', fontSize: 13 }}>加载中…</div>
            ) : (
              <>
                <div style={{ fontSize: 11, color: 'var(--fm-ink-4)', fontFamily: 'var(--font-geist-mono)', marginBottom: 8 }}>口味</div>
                {!stats?.byTaste.length ? (
                  <div style={{ fontSize: 12.5, color: 'var(--fm-ink-4)', marginBottom: 16 }}>暂无</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                    {stats.byTaste.map(({ name, count }) => (
                      <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 56, fontSize: 12.5, color: 'var(--fm-ink-2)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                        <HBar pct={(count / Math.max(...stats.byTaste.map(t => t.count), 1)) * 100} color="#c8883a" />
                        <div style={{ width: 22, textAlign: 'right', fontSize: 12, fontFamily: 'var(--font-geist-mono)', color: 'var(--fm-ink-3)', flexShrink: 0 }}>{count}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--fm-ink-4)', fontFamily: 'var(--font-geist-mono)', marginBottom: 8 }}>场合</div>
                {!stats?.byScene.length ? (
                  <div style={{ fontSize: 12.5, color: 'var(--fm-ink-4)' }}>暂无</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {stats.byScene.map(({ name, count }) => (
                      <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 56, fontSize: 12.5, color: 'var(--fm-ink-2)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                        <HBar pct={(count / Math.max(...stats.byScene.map(s => s.count), 1)) * 100} color="#4a3d6b" />
                        <div style={{ width: 22, textAlign: 'right', fontSize: 12, fontFamily: 'var(--font-geist-mono)', color: 'var(--fm-ink-3)', flexShrink: 0 }}>{count}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* D. AI summary */}
        <div style={{ ...CARD, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ ...SECTION_LABEL, marginBottom: 0 }}>AI 口味总结</div>
            <div style={{ fontSize: 12, color: 'var(--fm-ink-4)' }}>基于以上数据生成约 150-200 字分析</div>
            <div style={{ flex: 1 }} />
            {aiStreaming && <Spinner />}
            <button
              onClick={handleAiSummary}
              disabled={aiStreaming || aiDone || statsLoading || !stats}
              style={{
                height: 30,
                paddingLeft: 14,
                paddingRight: 14,
                borderRadius: 7,
                border: 'none',
                background: aiDone || aiStreaming ? 'var(--fm-muted)' : 'var(--fm-orange)',
                color: aiDone || aiStreaming ? 'var(--fm-ink-4)' : '#fff',
                fontSize: 12.5,
                fontFamily: 'var(--font-geist-sans)',
                fontWeight: 500,
                cursor: aiDone || aiStreaming || statsLoading ? 'not-allowed' : 'pointer',
                flexShrink: 0,
                transition: 'background 0.15s',
              }}
            >
              {aiDone ? '已生成' : aiStreaming ? '分析中…' : '让 AI 分析一下'}
            </button>
          </div>
          {aiSummary ? (
            <div style={{
              fontSize: 14,
              lineHeight: 1.7,
              color: 'var(--fm-ink)',
              whiteSpace: 'pre-wrap',
              background: 'var(--fm-paper)',
              borderRadius: 8,
              padding: '14px 16px',
              border: '1px solid var(--fm-line)',
              minHeight: 80,
            }}>
              {aiSummary}
              {aiStreaming && <span style={{ opacity: 0.5 }}>▋</span>}
            </div>
          ) : (
            <div style={{
              fontSize: 13,
              color: 'var(--fm-ink-4)',
              fontStyle: 'italic',
              background: 'var(--fm-paper)',
              borderRadius: 8,
              padding: '14px 16px',
              border: '1px solid var(--fm-line)',
            }}>
              点击按钮生成分析
            </div>
          )}
        </div>

        {/* E. Management */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={CARD}>
            <div style={SECTION_LABEL}>待审核推荐</div>
            {adminLoading ? (
              <div style={{ color: 'var(--fm-ink-4)', fontSize: 13 }}>加载中…</div>
            ) : pinRequests.length === 0 ? (
              <div style={{ color: 'var(--fm-ink-4)', fontSize: 13 }}>暂无</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {pinRequests.map(req => (
                  <div key={req.id} style={{
                    background: 'var(--fm-paper)',
                    border: '1px solid var(--fm-line)',
                    borderRadius: 8,
                    padding: '12px 14px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                      <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--fm-ink)' }}>{req.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--fm-ink-4)', flexShrink: 0 }}>{req.author_name}</div>
                    </div>
                    {req.notes && (
                      <div style={{
                        fontSize: 12.5, color: 'var(--fm-ink-3)', marginBottom: 10,
                        overflow: 'hidden', display: '-webkit-box',
                        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      }}>
                        {req.notes}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => handleApprove(req.id)}
                        disabled={actingId === req.id}
                        style={{
                          height: 28, paddingLeft: 12, paddingRight: 12,
                          borderRadius: 6, border: 'none',
                          background: 'var(--fm-green)', color: '#fff',
                          fontSize: 12, fontWeight: 500, cursor: 'pointer',
                          opacity: actingId === req.id ? 0.5 : 1,
                        }}
                      >
                        通过
                      </button>
                      <button
                        onClick={() => handleReject(req.id)}
                        disabled={actingId === req.id}
                        style={{
                          height: 28, paddingLeft: 12, paddingRight: 12,
                          borderRadius: 6,
                          border: '1px solid var(--fm-line-2)',
                          background: 'transparent',
                          color: 'var(--fm-ink-3)',
                          fontSize: 12, fontWeight: 500, cursor: 'pointer',
                          opacity: actingId === req.id ? 0.5 : 1,
                        }}
                      >
                        拒绝
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={CARD}>
            <div style={SECTION_LABEL}>AI 回答反馈</div>
            {adminLoading ? (
              <div style={{ color: 'var(--fm-ink-4)', fontSize: 13 }}>加载中…</div>
            ) : feedback.length === 0 ? (
              <div style={{ color: 'var(--fm-ink-4)', fontSize: 13 }}>暂无</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {feedback.map(fb => (
                  <div key={fb.id} style={{
                    background: 'var(--fm-paper)',
                    border: '1px solid var(--fm-line)',
                    borderRadius: 8,
                    padding: '12px 14px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                      <div style={{ fontSize: 11.5, color: 'var(--fm-ink-4)', fontFamily: 'var(--font-geist-mono)' }}>
                        {new Date(fb.created_at).toLocaleDateString('zh-CN')}
                      </div>
                      <button
                        onClick={() => handleDeleteFeedback(fb.id)}
                        disabled={actingId === fb.id}
                        style={{
                          height: 22, paddingLeft: 10, paddingRight: 10,
                          borderRadius: 5, border: '1px solid var(--fm-line)',
                          background: 'transparent', color: 'var(--fm-ink-4)',
                          fontSize: 11, cursor: 'pointer',
                          opacity: actingId === fb.id ? 0.5 : 1,
                        }}
                      >
                        删除
                      </button>
                    </div>
                    {fb.feedback_text && (
                      <div style={{ fontSize: 13, color: 'var(--fm-ink)', marginBottom: 6, fontWeight: 500 }}>
                        {fb.feedback_text}
                      </div>
                    )}
                    {fb.msg_content && (
                      <div style={{
                        fontSize: 12, color: 'var(--fm-ink-3)',
                        overflow: 'hidden', display: '-webkit-box',
                        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      }}>
                        {fb.msg_content}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  )
}
