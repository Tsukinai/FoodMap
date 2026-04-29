'use client'

import { useState } from 'react'
import type { Tag, FilterPayload } from '@/lib/types'

interface Props {
  allTags: Tag[]
  onFilter: (payload: Partial<FilterPayload>) => void
}

export default function SmartSearchBar({ allTags, onFilter }: Props) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [interpreted, setInterpreted] = useState<string | null>(null)

  async function handleSearch() {
    if (!query.trim()) return
    setLoading(true)
    setInterpreted(null)
    try {
      const res = await fetch('/api/llm-filter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), availableTags: allTags }),
      })
      const payload = await res.json()
      onFilter(payload)

      const parts: string[] = []
      if (payload.regions?.length > 0) parts.push(payload.regions.join('、'))
      if (payload.cuisine_tags?.length > 0) parts.push(payload.cuisine_tags.join('、'))
      if (payload.taste_tags?.length > 0) parts.push(payload.taste_tags.join('、'))
      if (payload.max_cost) parts.push(`≤$${payload.max_cost}/人`)
      if (payload.area_keyword) parts.push(`"${payload.area_keyword}"`)
      setInterpreted(parts.length > 0 ? parts.join(' · ') : '已应用筛选')
    } catch {
      setInterpreted('解析失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-1.5">
      <div
        className="flex items-center gap-2 rounded-lg px-3"
        style={{
          background: 'var(--fm-paper)',
          border: '1px solid var(--fm-line-2)',
          height: 44,
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="邮编、地址，或问一句话…"
          className="flex-1 bg-transparent outline-none text-sm"
          style={{ color: 'var(--fm-ink)' }}
          disabled={loading}
        />
        {query.trim() ? (
          <button
            onClick={handleSearch}
            disabled={loading}
            className="rounded px-1.5 py-0.5 transition-colors"
            style={{
              fontFamily: 'var(--font-geist-mono)',
              fontSize: '1rem',
              fontWeight: 500,
              background: loading ? 'var(--fm-line)' : 'var(--fm-orange)',
              color: '#fff',
            }}
          >
            {loading ? '…' : 'AI'}
          </button>
        ) : (
          <span
            style={{
              fontFamily: 'var(--font-geist-mono)',
              fontSize: '1rem',
              color: 'var(--fm-ink-4)',
              border: '1px solid var(--fm-line-2)',
              borderRadius: 3,
              padding: '2px 6px',
            }}
          >
            ⌘K
          </span>
        )}
      </div>
      {interpreted && (
        <p
          className="rounded px-2 py-1"
          style={{
            fontFamily: 'var(--font-geist-mono)',
            fontSize: '1rem',
            background: '#f0d9c4',
            color: 'var(--fm-orange-dark)',
          }}
        >
          {interpreted}
        </p>
      )}
    </div>
  )
}
