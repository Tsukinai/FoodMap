'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import type { Restaurant, Tag, FilterPayload } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import FilterPanel from '@/components/sidebar/FilterPanel'
import RestaurantList from '@/components/RestaurantList'
import GuestbookPanel from '@/components/guestbook/GuestbookPanel'
import DisclaimerModal from '@/components/DisclaimerModal'
import RecommendChat from '@/components/recommend/RecommendChat'
import PinRequestModal from '@/components/pin-requests/PinRequestModal'
import PinRequestsPanel from '@/components/pin-requests/PinRequestsPanel'

const MapContainer = dynamic(() => import('@/components/map/MapContainer'), {
  ssr: false,
  loading: () => (
    <div
      className="flex-1 flex items-center justify-center text-sm"
      style={{ background: 'var(--fm-cream)', color: 'var(--fm-ink-3)', fontFamily: 'var(--font-geist-mono)' }}
    >
      加载地图中…
    </div>
  ),
})

const DEFAULT_FILTERS: FilterPayload = {
  cuisine_tags: [],
  dish_tags: [],
  taste_tags: [],
  scene_tags: [],
  max_cost: null,
  min_cost: null,
  status: [],
  ratings: [],
  areas: [],
}

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([])
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState<FilterPayload>(DEFAULT_FILTERS)
  const [loading, setLoading] = useState(true)
  const [addingPin, setAddingPin] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'map' | 'list' | 'guestbook'>('map')
  const [chatOpen, setChatOpen] = useState(false)
  const [highlightedIds, setHighlightedIds] = useState<string[] | null>(null)
  const [pinRequestOpen, setPinRequestOpen] = useState(false)
  const [requestsOpen, setRequestsOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setIsOwner(!!user && user.id === process.env.NEXT_PUBLIC_OWNER_USER_ID)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      setIsOwner(!!u && u.id === process.env.NEXT_PUBLIC_OWNER_USER_ID)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const update = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (!mobile) setSidebarOpen(true)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // restore sidebar state on mobile from localStorage
  useEffect(() => {
    if (!isMobile) return
    const saved = localStorage.getItem('sidebar-open')
    if (saved !== null) setSidebarOpen(saved === 'true')
  }, [isMobile])

  // persist sidebar state changes (mobile only)
  useEffect(() => {
    if (!isMobile) return
    localStorage.setItem('sidebar-open', String(sidebarOpen))
  }, [sidebarOpen, isMobile])

  const filtersRef = useRef(filters)
  filtersRef.current = filters

  const fetchRestaurants = useCallback(async () => {
    const f = filtersRef.current
    const params = new URLSearchParams()
    if (f.cuisine_tags.length > 0) params.set('cuisine_tags', f.cuisine_tags.join(','))
    if (f.dish_tags.length > 0) params.set('dish_tags', f.dish_tags.join(','))
    if (f.taste_tags?.length > 0) params.set('taste_tags', f.taste_tags.join(','))
    if (f.scene_tags?.length > 0) params.set('scene_tags', f.scene_tags.join(','))
    if (f.max_cost) params.set('max_cost', String(f.max_cost))
    if (f.min_cost) params.set('min_cost', String(f.min_cost))
    if (f.status?.length === 1) params.set('status', f.status[0])
    if (f.ratings?.length > 0) params.set('ratings', f.ratings.join(','))

    try {
      const res = await fetch(`/api/restaurants?${params}`)
      const data = await res.json()
      setAllRestaurants(Array.isArray(data) ? data : [])
    } catch {
      setAllRestaurants([])
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch('/api/tags')
      const data = await res.json()
      setAllTags(Array.isArray(data) ? data : [])
    } catch {
      setAllTags([])
    }
  }, [])

  const displayedRestaurants = useMemo(() => {
    let results = allRestaurants
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      results = results.filter(r => r.name.toLowerCase().includes(q))
    }
    if (filters.areas.length > 0) {
      results = results.filter(r => r.planning_area !== null && filters.areas.includes(r.planning_area))
    }
    return results
  }, [allRestaurants, searchQuery, filters.areas])

  const availableAreas = useMemo(() => {
    const seen = new Set<string>()
    allRestaurants.forEach(r => { if (r.planning_area) seen.add(r.planning_area) })
    return Array.from(seen).sort()
  }, [allRestaurants])

  const fetchPendingCount = useCallback(async () => {
    if (!isOwner) return
    try {
      const res = await fetch('/api/pin-requests')
      const data = await res.json()
      setPendingCount(Array.isArray(data) ? data.length : 0)
    } catch {
      setPendingCount(0)
    }
  }, [isOwner])

  useEffect(() => { fetchRestaurants() }, [filters]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { fetchTags() }, [fetchTags])
  useEffect(() => { fetchPendingCount() }, [fetchPendingCount])

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden" style={{ background: 'var(--fm-cream)' }}>
      <DisclaimerModal />
      {pinRequestOpen && (
        <PinRequestModal
          onClose={() => setPinRequestOpen(false)}
          onSubmitted={() => setPinRequestOpen(false)}
        />
      )}
      {requestsOpen && (
        <PinRequestsPanel
          allTags={allTags}
          onClose={() => setRequestsOpen(false)}
          onChanged={() => { fetchPendingCount(); fetchRestaurants() }}
        />
      )}

      {/* ── Header ── */}
      <header
        style={{
          position: 'relative',
          height: 52,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 10,
          paddingRight: 14,
          gap: 10,
          background: 'var(--fm-paper)',
          borderBottom: '1px solid var(--fm-line)',
          zIndex: 20,
        }}
      >
        {/* Hamburger */}
        <button
          onClick={() => {
            setSidebarOpen(s => !s)
            if (isMobile && !sidebarOpen) setChatOpen(false)
          }}
          title={sidebarOpen ? '收起筛选' : '展开筛选'}
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            background: sidebarOpen ? 'var(--fm-cream)' : 'transparent',
            border: '1px solid var(--fm-line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 15,
            color: 'var(--fm-ink-2)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          ☰
        </button>

        {/* Logo */}
        <div
          style={{
            fontFamily: 'var(--font-instrument-serif)',
            fontSize: 22,
            letterSpacing: '-0.01em',
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          食迹<span style={{ color: 'var(--fm-orange)' }}>.</span>
        </div>

        <div style={{ flex: 1 }} />

        {/* View mode tabs — desktop only, centered absolutely */}
        {!isMobile && (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              background: 'var(--fm-cream)',
              borderRadius: 9,
              padding: 3,
              gap: 2,
            }}
          >
            {([
              ['map', '地图', <svg key="m" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>],
              ['list', '列表', <svg key="l" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>],
              ['guestbook', '留言', <svg key="g" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>],
            ] as [string, string, React.ReactNode][]).map(([mode, label, icon]) => {
              const active = viewMode === mode
              return (
                <button
                  key={mode}
                  onClick={() => {
                    setViewMode(mode as 'map' | 'list' | 'guestbook')
                    if (mode !== 'map') setEditMode(false)
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    height: 30,
                    paddingLeft: 10,
                    paddingRight: 10,
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 12.5,
                    fontFamily: 'var(--font-geist-sans)',
                    fontWeight: active ? 600 : 400,
                    background: active ? 'var(--fm-paper)' : 'transparent',
                    color: active ? 'var(--fm-ink)' : 'var(--fm-ink-3)',
                    boxShadow: active ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {icon}
                  {label}
                </button>
              )
            })}
          </div>
        )}

        {/* Owner controls — map mode only */}
        {isOwner && viewMode === 'map' && (
          <>
            {!isMobile && <div style={{ width: 1, height: 22, background: 'var(--fm-line)', flexShrink: 0 }} />}
            {isMobile ? (
              /* Mobile: icon-only */
              <>
                <button
                  onClick={() => setEditMode(v => !v)}
                  title={editMode ? '退出编辑' : '编辑模式'}
                  style={{
                    width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                    border: `1.5px solid ${editMode ? 'var(--fm-ink)' : 'var(--fm-line-2)'}`,
                    background: editMode ? 'var(--fm-ink)' : 'var(--fm-paper)',
                    color: editMode ? 'var(--fm-paper)' : 'var(--fm-ink-2)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button
                  onClick={() => setAddingPin(true)}
                  title="打地图钉"
                  style={{
                    width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                    border: 'none', background: 'var(--fm-orange)', color: '#fff',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, fontWeight: 400, lineHeight: 1,
                  }}
                >
                  +
                </button>
              </>
            ) : (
              /* Desktop: text buttons */
              <>
                <Link
                  href="/dashboard"
                  style={{
                    height: 32, paddingLeft: 12, paddingRight: 12, borderRadius: 8, flexShrink: 0,
                    border: '1px solid var(--fm-line)',
                    background: 'var(--fm-paper)',
                    color: 'var(--fm-ink-3)',
                    fontSize: 12.5, fontFamily: 'var(--font-geist-sans)', fontWeight: 500,
                    cursor: 'pointer', textDecoration: 'none',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  仪表盘
                </Link>
                <button
                  onClick={() => setEditMode(v => !v)}
                  style={{
                    height: 32, paddingLeft: 12, paddingRight: 12, borderRadius: 8, flexShrink: 0,
                    border: `1.5px solid ${editMode ? 'var(--fm-ink)' : 'var(--fm-line-2)'}`,
                    background: editMode ? 'var(--fm-ink)' : 'var(--fm-paper)',
                    color: editMode ? 'var(--fm-paper)' : 'var(--fm-ink-2)',
                    fontSize: 12.5, fontFamily: 'var(--font-geist-sans)', fontWeight: 500,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {editMode ? '退出编辑' : '编辑模式'}
                </button>
                <button
                  onClick={() => setAddingPin(true)}
                  style={{
                    height: 32, paddingLeft: 12, paddingRight: 12, borderRadius: 8, flexShrink: 0,
                    border: 'none', background: 'var(--fm-orange)', color: '#fff',
                    fontSize: 12.5, fontFamily: 'var(--font-geist-sans)', fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  ＋ 打地图钉
                </button>
              </>
            )}
          </>
        )}

        {/* Non-owner: recommend a restaurant */}
        {!isOwner && user && (
          <button
            onClick={() => setPinRequestOpen(true)}
            style={{
              height: 32,
              paddingLeft: 12,
              paddingRight: 12,
              borderRadius: 8,
              background: 'transparent',
              border: '1px solid var(--fm-line)',
              color: 'var(--fm-ink-2)',
              fontSize: 12.5,
              fontFamily: 'var(--font-geist-sans)',
              fontWeight: 500,
              cursor: 'pointer',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            推荐餐馆
          </button>
        )}

        {/* Owner: pending requests */}
        {isOwner && (
          <button
            onClick={() => setRequestsOpen(true)}
            style={{
              position: 'relative',
              height: 32,
              paddingLeft: 12,
              paddingRight: 12,
              borderRadius: 8,
              background: pendingCount > 0 ? '#fdf0e6' : 'transparent',
              border: `1px solid ${pendingCount > 0 ? '#c8883a' : 'var(--fm-line)'}`,
              color: pendingCount > 0 ? '#c8883a' : 'var(--fm-ink-3)',
              fontSize: 12.5,
              fontFamily: 'var(--font-geist-sans)',
              fontWeight: pendingCount > 0 ? 600 : 400,
              cursor: 'pointer',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            待审{pendingCount > 0 ? ` (${pendingCount})` : ''}
          </button>
        )}

        {/* Chat toggle — far right, mirrors hamburger on left */}
        <button
          onClick={() => {
            setChatOpen(v => !v)
            if (isMobile && !chatOpen) setSidebarOpen(false)
          }}
          title={chatOpen ? '收起 AI 推荐' : '展开 AI 推荐'}
          style={{
            position: 'relative',
            height: 32,
            paddingLeft: 12,
            paddingRight: 12,
            borderRadius: 8,
            background: chatOpen ? 'var(--fm-ink)' : 'transparent',
            border: `1px solid ${chatOpen ? 'var(--fm-ink)' : 'var(--fm-line)'}`,
            color: chatOpen ? 'var(--fm-paper)' : 'var(--fm-ink-2)',
            fontSize: 12.5,
            fontFamily: 'var(--font-geist-sans)',
            fontWeight: 500,
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'all 0.15s',
            whiteSpace: 'nowrap',
          }}
        >
          AI 推荐
          {highlightedIds !== null && highlightedIds.length > 0 && !chatOpen && (
            <span
              style={{
                position: 'absolute',
                top: -3,
                right: -3,
                minWidth: 14,
                height: 14,
                padding: '0 3px',
                borderRadius: 99,
                background: 'var(--fm-orange)',
                color: '#fff',
                fontSize: 9,
                fontFamily: 'var(--font-geist-mono)',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
                border: '1.5px solid var(--fm-paper)',
              }}
            >
              {highlightedIds.length}
            </span>
          )}
        </button>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden" style={{ position: 'relative' }}>
        {/* Mobile backdrop — covers either open sidebar */}
        {isMobile && (sidebarOpen || chatOpen) && (
          <div
            className="fixed inset-0"
            style={{ background: 'var(--fm-overlay)', zIndex: 40, top: 52 }}
            onClick={() => { setSidebarOpen(false); setChatOpen(false) }}
          />
        )}

        {/* Sidebar — collapsible wrapper */}
        <div
          style={isMobile ? {
            position: 'fixed',
            top: 52,
            left: 0,
            height: 'calc(100% - 52px)',
            width: sidebarOpen ? 292 : 0,
            zIndex: 50,
            overflow: 'hidden',
            transition: 'width 0.25s cubic-bezier(.4,0,.2,1)',
          } : {
            width: sidebarOpen ? 292 : 0,
            flexShrink: 0,
            overflow: 'hidden',
            transition: 'width 0.25s cubic-bezier(.4,0,.2,1)',
          }}
        >
          <FilterPanel
            allTags={allTags}
            filters={filters}
            onChange={setFilters}
            restaurantCount={displayedRestaurants.length}
            user={user}
            isOwner={isOwner}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            availableAreas={availableAreas}
            viewMode={viewMode}
            onViewModeChange={(mode) => {
              setViewMode(mode)
              if (mode !== 'map') setEditMode(false)
            }}
            showViewToggle={isMobile}
          />
        </div>

        {/* Main content: map, list, or guestbook */}
        <div className="flex-1 relative min-w-0">
          {viewMode === 'guestbook' ? (
            <GuestbookPanel user={user} isOwner={isOwner} />
          ) : viewMode === 'list' ? (
            <RestaurantList
              restaurants={displayedRestaurants}
              loading={loading}
              isOwner={isOwner}
              onSaved={() => { fetchRestaurants(); fetchTags() }}
            />
          ) : loading ? (
            <div
              className="flex items-center justify-center h-full text-sm"
              style={{ background: 'var(--fm-cream)', color: 'var(--fm-ink-3)', fontFamily: 'var(--font-geist-mono)' }}
            >
              加载中…
            </div>
          ) : (
            <MapContainer
              restaurants={displayedRestaurants}
              isOwner={isOwner}
              filters={filters}
              addingPin={addingPin}
              onAddingPinChange={setAddingPin}
              editMode={editMode}
              highlightedIds={highlightedIds}
              onRestaurantSaved={() => {
                fetchRestaurants()
                fetchTags()
              }}
            />
          )}
        </div>

        {/* Right chat sidebar — mirrors FilterPanel on the left */}
        <div
          style={isMobile ? {
            position: 'fixed',
            top: 52,
            right: 0,
            height: 'calc(100% - 52px)',
            width: chatOpen ? 'min(360px, 100vw)' : 0,
            zIndex: 50,
            overflow: 'hidden',
            transition: 'width 0.25s cubic-bezier(.4,0,.2,1)',
          } : {
            width: chatOpen ? 360 : 0,
            flexShrink: 0,
            overflow: 'hidden',
            transition: 'width 0.25s cubic-bezier(.4,0,.2,1)',
          }}
        >
          <div style={{ width: isMobile ? 'min(360px, 100vw)' : 360, height: '100%' }}>
            <RecommendChat
              user={user}
              isOwner={isOwner}
              onClose={() => setChatOpen(false)}
              onHighlight={setHighlightedIds}
              onClearHighlight={() => setHighlightedIds(null)}
              highlightCount={highlightedIds !== null ? highlightedIds.length : null}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
