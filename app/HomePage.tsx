'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import type { Restaurant, Tag, FilterPayload } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import FilterPanel from '@/components/sidebar/FilterPanel'
import RestaurantList from '@/components/RestaurantList'

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
  area_keyword: null,
  regions: [],
}

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([])
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [filters, setFilters] = useState<FilterPayload>(DEFAULT_FILTERS)
  const [loading, setLoading] = useState(true)
  const [addingPin, setAddingPin] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map')

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

  const fetchRestaurants = useCallback(async () => {
    const params = new URLSearchParams()
    if (filters.cuisine_tags.length > 0) params.set('cuisine_tags', filters.cuisine_tags.join(','))
    if (filters.dish_tags.length > 0) params.set('dish_tags', filters.dish_tags.join(','))
    if (filters.taste_tags?.length > 0) params.set('taste_tags', filters.taste_tags.join(','))
    if (filters.scene_tags?.length > 0) params.set('scene_tags', filters.scene_tags.join(','))
    if (filters.max_cost) params.set('max_cost', String(filters.max_cost))
    if (filters.min_cost) params.set('min_cost', String(filters.min_cost))
    if (filters.area_keyword) params.set('area_keyword', filters.area_keyword)
    if (filters.regions.length > 0) params.set('regions', filters.regions.join(','))

    try {
      const res = await fetch(`/api/restaurants?${params}`)
      const data = await res.json()
      setAllRestaurants(Array.isArray(data) ? data : [])
    } catch {
      setAllRestaurants([])
    } finally {
      setLoading(false)
    }
  }, [filters])

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch('/api/tags')
      const data = await res.json()
      setAllTags(Array.isArray(data) ? data : [])
    } catch {
      setAllTags([])
    }
  }, [])

  useEffect(() => { fetchRestaurants() }, [fetchRestaurants])
  useEffect(() => { fetchTags() }, [fetchTags])

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: 'var(--fm-cream)' }}>
      {/* Sidebar — collapsible wrapper */}
      <div
        style={{
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
          restaurantCount={allRestaurants.length}
          user={user}
          isOwner={isOwner}
          onCollapse={() => setSidebarOpen(false)}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      </div>

      {/* Map area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Floating expand button (shown when sidebar is collapsed) */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            title="展开侧边栏"
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
              fontSize: 15,
              color: 'var(--fm-ink)',
              cursor: 'pointer',
            }}
          >
            ▸
          </button>
        )}

        {/* Main content: map or list */}
        <div className="flex-1 relative">
          {viewMode === 'list' ? (
            <RestaurantList restaurants={allRestaurants} loading={loading} />
          ) : loading ? (
            <div
              className="flex items-center justify-center h-full text-sm"
              style={{ background: 'var(--fm-cream)', color: 'var(--fm-ink-3)', fontFamily: 'var(--font-geist-mono)' }}
            >
              加载中…
            </div>
          ) : (
            <MapContainer
              restaurants={allRestaurants}
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
