'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import dynamic from 'next/dynamic'
import type { Restaurant, Tag, FilterPayload } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import FilterPanel from '@/components/sidebar/FilterPanel'
import RestaurantList from '@/components/RestaurantList'
import GuestbookPanel from '@/components/guestbook/GuestbookPanel'
import DisclaimerModal from '@/components/DisclaimerModal'

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
  const [isMobile, setIsMobile] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'map' | 'list' | 'guestbook'>('map')

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
    if (!searchQuery.trim()) return allRestaurants
    const q = searchQuery.trim().toLowerCase()
    return allRestaurants.filter(r => r.name.toLowerCase().includes(q))
  }, [allRestaurants, searchQuery])

  useEffect(() => { fetchRestaurants() }, [filters]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { fetchTags() }, [fetchTags])

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: 'var(--fm-cream)' }}>
      <DisclaimerModal />
      {/* Mobile backdrop */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0"
          style={{ background: 'var(--fm-overlay)', zIndex: 40 }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — collapsible wrapper */}
      <div
        style={isMobile ? {
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100%',
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
          onCollapse={() => setSidebarOpen(false)}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>

      {/* Map area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Hamburger toggle — always visible */}
        <button
          onClick={() => setSidebarOpen(s => !s)}
          title={sidebarOpen ? '收起筛选' : '展开筛选'}
          style={{
            position: 'absolute',
            left: 16,
            top: 16,
            zIndex: 10,
            width: 38,
            height: 38,
            borderRadius: 10,
            background: 'var(--fm-paper)',
            border: '1px solid var(--fm-line)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 17,
            color: 'var(--fm-ink)',
            cursor: 'pointer',
          }}
        >
          ☰
        </button>

        {/* Main content: map, list, or guestbook */}
        <div className="flex-1 relative">
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
              onRestaurantSaved={() => {
                fetchRestaurants()
                fetchTags()
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
