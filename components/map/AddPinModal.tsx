'use client'

import { useState, useEffect } from 'react'
import type { Tag, Restaurant, RestaurantStatus, RestaurantRating } from '@/lib/types'
import { RATING_ORDER } from '@/lib/types'
import { getTagsByType } from '@/lib/utils'
import TagInput from '@/components/tags/TagInput'

interface Props {
  restaurant?: Restaurant
  lng?: number
  lat?: number
  onClose: () => void
  onSaved: () => void
}

export default function AddPinModal({ restaurant, lng, lat, onClose, onSaved }: Props) {
  const [name, setName] = useState(restaurant?.name ?? '')
  const [address, setAddress] = useState(restaurant?.address ?? '')
  const [postalCode, setPostalCode] = useState(restaurant?.postal_code ?? '')
  const [costMin, setCostMin] = useState<number | null>(restaurant?.cost_min ?? null)
  const [costMax, setCostMax] = useState<number | null>(restaurant?.cost_max ?? null)
  const [notes, setNotes] = useState(restaurant?.notes ?? '')
  const [signatureDishes, setSignatureDishes] = useState<string[]>(restaurant?.signature_dishes ?? [])
  const [cuisineTagIds, setCuisineTagIds] = useState<string[]>(
    getTagsByType(restaurant?.tags ?? [], 'cuisine').map((t) => t.id)
  )
  const [dishTagIds, setDishTagIds] = useState<string[]>(
    getTagsByType(restaurant?.tags ?? [], 'dish').map((t) => t.id)
  )
  const [tasteTagIds, setTasteTagIds] = useState<string[]>(
    getTagsByType(restaurant?.tags ?? [], 'taste').map((t) => t.id)
  )
  const [sceneTagIds, setSceneTagIds] = useState<string[]>(
    getTagsByType(restaurant?.tags ?? [], 'scene').map((t) => t.id)
  )
  const [status, setStatus] = useState<RestaurantStatus | null>(restaurant?.status ?? null)
  const [rating, setRating] = useState<RestaurantRating>(restaurant?.rating ?? '未评分')
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [saving, setSaving] = useState(false)

  const [chainSearchOpen, setChainSearchOpen] = useState(false)
  const [chainQuery, setChainQuery] = useState('')
  const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([])
  const [chainLoaded, setChainLoaded] = useState(false)

  const chainResults = chainQuery.trim()
    ? allRestaurants.filter((r) => r.name.includes(chainQuery.trim()))
    : []

  async function openChainSearch() {
    setChainSearchOpen(true)
    if (!chainLoaded) {
      const res = await fetch('/api/restaurants')
      const data: Restaurant[] = await res.json()
      setAllRestaurants(data)
      setChainLoaded(true)
    }
  }

  function applyChainTemplate(r: Restaurant) {
    setName(r.name)
    setNotes(r.notes ?? '')
    setSignatureDishes(r.signature_dishes)
    setCostMin(r.cost_min ?? null)
    setCostMax(r.cost_max ?? null)
    setStatus(r.status)
    setRating(r.rating)
    setCuisineTagIds(getTagsByType(r.tags, 'cuisine').map((t) => t.id))
    setDishTagIds(getTagsByType(r.tags, 'dish').map((t) => t.id))
    setTasteTagIds(getTagsByType(r.tags, 'taste').map((t) => t.id))
    setSceneTagIds(getTagsByType(r.tags, 'scene').map((t) => t.id))
    setChainSearchOpen(false)
    setChainQuery('')
  }

  const [pinLng, setPinLng] = useState(restaurant?.location_lng ?? lng ?? 0)
  const [pinLat, setPinLat] = useState(restaurant?.location_lat ?? lat ?? 0)

  type PlaceResult = { name: string; address: string; postal_code: string; lat: number; lng: number }
  const [addressResults, setAddressResults] = useState<PlaceResult[]>([])

  useEffect(() => {
    fetch('/api/tags').then((r) => r.json()).then(setAllTags)
  }, [])

  async function searchByAddress() {
    if (address.trim().length < 2) return
    const res = await fetch(`/api/places?q=${encodeURIComponent(address.trim())}`)
    const data = await res.json()
    setAddressResults(Array.isArray(data) ? data : [])
  }

  function selectAddress(p: PlaceResult) {
    if (!restaurant) setName(p.name)
    setAddress(p.address)
    setPostalCode(p.postal_code)
    setPinLng(p.lng)
    setPinLat(p.lat)
    setAddressResults([])
  }

  async function handleSave() {
    if (!name.trim() || !status) return
    setSaving(true)
    try {
      const url = restaurant ? `/api/restaurants/${restaurant.id}` : '/api/restaurants'
      await fetch(url, {
        method: restaurant ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          address: address || null,
          postal_code: postalCode || null,
          lng: pinLng,
          lat: pinLat,
          cost_min: costMin,
          cost_max: costMax,
          notes: notes || null,
          signature_dishes: signatureDishes,
          status: status!,
          rating,
          cuisine_tag_ids: cuisineTagIds,
          dish_tag_ids: dishTagIds,
          taste_tag_ids: tasteTagIds,
          scene_tag_ids: sceneTagIds,
        }),
      })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(31,28,24,0.4)', backdropFilter: 'blur(2px)' }}
    >
      <div
        className="relative rounded-xl overflow-hidden flex flex-col"
        style={{
          width: 680,
          maxWidth: '95vw',
          maxHeight: '90vh',
          background: 'var(--fm-paper)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
          color: 'var(--fm-ink)',
          fontFamily: 'var(--font-geist-sans)',
        }}
      >
        {/* Header */}
        <div className="fm-modal-header" style={{ padding: '28px 36px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-geist-mono)',
                  fontSize: 10,
                  color: 'var(--fm-ink-4)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  fontWeight: 500,
                  marginBottom: 6,
                }}
              >
                {restaurant ? '编辑地图钉' : '新建地图钉'}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-instrument-serif)',
                  fontSize: 32,
                  lineHeight: 1,
                  marginBottom: 20,
                }}
              >
                {restaurant ? restaurant.name : '打一个新地图钉'}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                flexShrink: 0,
                marginLeft: 12,
                width: 32,
                height: 32,
                borderRadius: 8,
                border: '1px solid var(--fm-line-2)',
                background: 'transparent',
                color: 'var(--fm-ink-3)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                lineHeight: 1,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--fm-muted)'; e.currentTarget.style.color = 'var(--fm-ink)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--fm-ink-3)' }}
              aria-label="关闭"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="fm-modal-body flex-1 overflow-y-auto" style={{ padding: '0 36px 28px' }}>
          {/* Name + Address row */}
          <div className="fm-modal-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: chainSearchOpen ? 6 : 14 }}>
            <div className="relative">
              <div style={{ position: 'relative' }}>
                <FmInput
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="餐馆名称 *"
                />
                {name && (
                  <button
                    type="button"
                    onClick={() => setName('')}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      border: 'none',
                      background: 'var(--fm-ink-4)',
                      color: 'var(--fm-paper)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      lineHeight: 1,
                      padding: 0,
                      opacity: 0.7,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7' }}
                    aria-label="清除店名"
                  >
                    ✕
                  </button>
                )}
              </div>
              {!restaurant && !chainSearchOpen && (
                <button
                  onClick={openChainSearch}
                  style={{
                    marginTop: 5,
                    fontSize: 12,
                    color: 'var(--fm-orange-dark)',
                    fontFamily: 'var(--font-geist-mono)',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    letterSpacing: '0.02em',
                  }}
                >
                  连锁分店，从已有店复制 →
                </button>
              )}
            </div>
            <div className="relative">
              <div style={{ position: 'relative' }}>
                <FmInput
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchByAddress() } }}
                  placeholder="输入地址，回车搜索…"
                />
                {address && (
                  <button
                    type="button"
                    onClick={() => { setAddress(''); setAddressResults([]) }}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      border: 'none',
                      background: 'var(--fm-ink-4)',
                      color: 'var(--fm-paper)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      lineHeight: 1,
                      padding: 0,
                      opacity: 0.7,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7' }}
                    aria-label="清除地址"
                  >
                    ✕
                  </button>
                )}
              </div>
              {addressResults.length > 0 && (
                <div
                  className="absolute top-full left-0 right-0 z-10 rounded-lg overflow-hidden"
                  style={{
                    border: '1px solid var(--fm-line-2)',
                    background: 'var(--fm-paper)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                    marginTop: 4,
                    maxHeight: 200,
                    overflowY: 'auto',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 6px 0' }}>
                    <button
                      onClick={() => setAddressResults([])}
                      style={{
                        fontSize: 11,
                        color: 'var(--fm-ink-4)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px 4px',
                        lineHeight: 1,
                      }}
                      aria-label="关闭搜索结果"
                    >
                      ✕
                    </button>
                  </div>
                  {addressResults.map((p, i) => (
                    <button
                      key={i}
                      className="fm-dropdown-item w-full text-left px-3 py-2.5"
                      style={{ color: 'var(--fm-ink-2)', borderBottom: '1px solid var(--fm-line)' }}
                      onClick={() => selectAddress(p)}
                    >
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--fm-ink-4)', marginTop: 1 }}>{p.address}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Chain restaurant copy search */}
          {chainSearchOpen && (
            <div style={{ marginBottom: 14, position: 'relative' }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <FmInput
                    value={chainQuery}
                    onChange={(e) => setChainQuery(e.target.value)}
                    placeholder="搜索已有餐馆名称…"
                  />
                  {chainResults.length > 0 && (
                    <div
                      className="absolute top-full left-0 right-0 z-20 rounded-lg overflow-hidden"
                      style={{
                        border: '1px solid var(--fm-line-2)',
                        background: 'var(--fm-paper)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                        marginTop: 4,
                        maxHeight: 180,
                        overflowY: 'auto',
                      }}
                    >
                      {chainResults.map((r) => (
                        <button
                          key={r.id}
                          className="fm-dropdown-item w-full text-left px-3 py-2.5 text-base"
                          style={{ color: 'var(--fm-ink-2)', borderBottom: '1px solid var(--fm-line)' }}
                          onClick={() => applyChainTemplate(r)}
                        >
                          <span style={{ fontWeight: 500 }}>{r.name}</span>
                          {r.tags.filter((t) => t.type === 'cuisine').length > 0 && (
                            <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--fm-ink-4)', fontFamily: 'var(--font-geist-mono)' }}>
                              {r.tags.filter((t) => t.type === 'cuisine').map((t) => t.name).join(' · ')}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => { setChainSearchOpen(false); setChainQuery('') }}
                  style={{
                    fontSize: 12,
                    color: 'var(--fm-ink-4)',
                    fontFamily: 'var(--font-geist-mono)',
                    background: 'none',
                    border: 'none',
                    padding: '0 4px',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  取消
                </button>
              </div>
            </div>
          )}


          {/* Cuisine tags */}
          <FormSection label="菜系">
            <TagInput
              type="cuisine"
              allTags={allTags}
              selectedIds={cuisineTagIds}
              onChange={setCuisineTagIds}
              onTagCreated={(tag) => setAllTags((prev) => [...prev, tag])}
              onTagDeleted={(id) => setAllTags((prev) => prev.filter((t) => t.id !== id))}
              canManage
            />
          </FormSection>

          {/* Signature dishes */}
          <FormSection label="招牌菜">
            <SignatureDishInput dishes={signatureDishes} onChange={setSignatureDishes} />
          </FormSection>

          {/* Dish tags */}
          <FormSection label="种类 / 菜品">
            <TagInput
              type="dish"
              allTags={allTags}
              selectedIds={dishTagIds}
              onChange={setDishTagIds}
              onTagCreated={(tag) => setAllTags((prev) => [...prev, tag])}
              onTagDeleted={(id) => setAllTags((prev) => prev.filter((t) => t.id !== id))}
              canManage
            />
          </FormSection>

          {/* Cost + Taste row */}
          <div className="fm-modal-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 14 }}>
            <FormSection label="人均消费 (S$)" noMargin>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 13, color: 'var(--fm-ink-3)' }}>$</span>
                <input
                  type="number"
                  value={costMin ?? ''}
                  onChange={(e) => setCostMin(e.target.value === '' ? null : Math.max(0, Number(e.target.value)))}
                  placeholder="最少"
                  min={0}
                  style={{ width: 64, border: '1px solid var(--fm-line-2)', borderRadius: 6, padding: '6px 8px', fontSize: 13, fontFamily: 'var(--font-geist-mono)', color: 'var(--fm-ink)', outline: 'none', textAlign: 'center', background: 'var(--fm-paper)' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--fm-ink)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--fm-line-2)')}
                />
                <span style={{ color: 'var(--fm-ink-3)', fontFamily: 'var(--font-geist-mono)', fontSize: 13 }}>–</span>
                <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 13, color: 'var(--fm-ink-3)' }}>$</span>
                <input
                  type="number"
                  value={costMax ?? ''}
                  onChange={(e) => setCostMax(e.target.value === '' ? null : Math.max(0, Number(e.target.value)))}
                  placeholder="不限"
                  min={0}
                  style={{ width: 64, border: '1px solid var(--fm-line-2)', borderRadius: 6, padding: '6px 8px', fontSize: 13, fontFamily: 'var(--font-geist-mono)', color: 'var(--fm-ink)', outline: 'none', textAlign: 'center', background: 'var(--fm-paper)' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--fm-ink)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--fm-line-2)')}
                />
              </div>
            </FormSection>

            <FormSection label="口味" noMargin>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {allTags.filter((t) => t.type === 'taste').map((tag) => {
                  const active = tasteTagIds.includes(tag.id)
                  return (
                    <button
                      key={tag.id}
                      onClick={() => setTasteTagIds((prev) => active ? prev.filter((i) => i !== tag.id) : [...prev, tag.id])}
                      className="fm-tag fm-tag-taste"
                      style={{ outline: active ? '1.5px solid var(--fm-orange-dark)' : 'none', cursor: 'pointer' }}
                    >
                      {tag.name}
                    </button>
                  )
                })}
              </div>
            </FormSection>
          </div>

          {/* Scene tags */}
          <FormSection label="场合">
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {allTags.filter((t) => t.type === 'scene').map((tag) => {
                const active = sceneTagIds.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    onClick={() => setSceneTagIds((prev) => active ? prev.filter((i) => i !== tag.id) : [...prev, tag.id])}
                    className="fm-tag fm-tag-scene"
                    style={{ outline: active ? '1.5px solid #4a3d6b' : 'none', cursor: 'pointer' }}
                  >
                    {tag.name}
                  </button>
                )
              })}
            </div>
          </FormSection>

          {/* Status + Rating row */}
          <div className="fm-modal-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 14 }}>
            <FormSection label="状态" noMargin>
              <div style={{ display: 'flex', gap: 6 }}>
                {([['want', '想吃'], ['visited', '已吃']] as [RestaurantStatus, string][]).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setStatus(val)}
                    style={{
                      flex: 1,
                      padding: '8px 0',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 500,
                      fontFamily: 'var(--font-geist-sans)',
                      border: status === val
                        ? val === 'want' ? '1.5px solid #c8883a' : '1.5px solid var(--fm-green)'
                        : '1px solid var(--fm-line-2)',
                      background: status === val
                        ? val === 'want' ? '#fdf0e6' : '#eaf4ee'
                        : 'var(--fm-paper)',
                      color: status === val
                        ? val === 'want' ? '#c8883a' : 'var(--fm-green)'
                        : 'var(--fm-ink-3)',
                      cursor: 'pointer',
                      transition: 'all 0.12s',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </FormSection>

            <FormSection label="评分" noMargin>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {RATING_ORDER.map((r) => {
                  const { bg, color, border } = getRatingStyle(r)
                  const active = rating === r
                  return (
                    <button
                      key={r}
                      onClick={() => setRating(r)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 7,
                        fontSize: 12,
                        fontWeight: 500,
                        fontFamily: 'var(--font-geist-sans)',
                        background: active ? bg : 'var(--fm-paper)',
                        color: active ? color : 'var(--fm-ink-3)',
                        border: active ? `1.5px solid ${border}` : '1px solid var(--fm-line-2)',
                        cursor: 'pointer',
                        transition: 'all 0.12s',
                      }}
                    >
                      {r}
                    </button>
                  )
                })}
              </div>
            </FormSection>
          </div>

          {/* Notes */}
          <FormSection label="笔记">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="推荐菜品、特别提示、下次记得…"
              style={{
                width: '100%',
                minHeight: 72,
                borderRadius: 8,
                border: '1px solid var(--fm-line-2)',
                background: 'var(--fm-paper)',
                padding: '10px 12px',
                fontSize: '1rem',
                fontFamily: 'var(--font-geist-sans)',
                color: 'var(--fm-ink)',
                resize: 'none',
                outline: 'none',
                fontStyle: 'italic',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--fm-ink)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--fm-line-2)')}
            />
          </FormSection>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button
              onClick={onClose}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                fontSize: 13.5,
                fontWeight: 500,
                border: '1px solid var(--fm-line-2)',
                background: 'transparent',
                color: 'var(--fm-ink-2)',
                cursor: 'pointer',
                fontFamily: 'var(--font-geist-sans)',
              }}
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim() || !address.trim() || !status}
              style={{
                padding: '10px 18px',
                borderRadius: 8,
                fontSize: 13.5,
                fontWeight: 500,
                border: '1px solid var(--fm-orange)',
                background: saving || !name.trim() || !address.trim() || !status ? 'var(--fm-ink-4)' : 'var(--fm-orange)',
                borderColor: saving || !name.trim() || !address.trim() || !status ? 'var(--fm-ink-4)' : 'var(--fm-orange)',
                color: '#fff',
                cursor: saving || !name.trim() || !address.trim() || !status ? 'default' : 'pointer',
                fontFamily: 'var(--font-geist-sans)',
                boxShadow: '0 4px 10px rgba(217,107,44,0.25)',
              }}
            >
              {saving ? '保存中…' : restaurant ? '保存' : '保存为新钉'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function getRatingStyle(rating: string): { bg: string; color: string; border: string } {
  switch (rating) {
    case '夯':    return { bg: '#fee2e2', color: '#dc2626', border: '#dc2626' }
    case '顶级':  return { bg: '#fef3c7', color: '#d97706', border: '#d97706' }
    case '人上人': return { bg: '#ede9fe', color: '#7c3aed', border: '#7c3aed' }
    case 'NPC':   return { bg: '#f3f4f6', color: '#6b7280', border: '#9ca3af' }
    case '拉完了': return { bg: '#e5e7eb', color: '#374151', border: '#6b7280' }
    default:      return { bg: 'var(--fm-muted)', color: 'var(--fm-ink-4)', border: 'var(--fm-line-2)' }
  }
}

function FmInput({ value, onChange, onKeyDown, placeholder }: {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  placeholder?: string
}) {
  return (
    <input
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      style={{
        width: '100%',
        background: 'var(--fm-paper)',
        border: '1px solid var(--fm-line-2)',
        borderRadius: 8,
        padding: '12px 14px',
        fontSize: '1rem',
        fontFamily: 'var(--font-geist-sans)',
        color: 'var(--fm-ink)',
        outline: 'none',
      }}
      onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--fm-ink)')}
      onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--fm-line-2)')}
    />
  )
}

function SignatureDishInput({ dishes, onChange }: { dishes: string[]; onChange: (d: string[]) => void }) {
  const [input, setInput] = useState('')

  function add() {
    const name = input.trim()
    if (!name || dishes.includes(name)) return
    onChange([...dishes, name])
    setInput('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {dishes.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {dishes.map((d) => (
            <button
              key={d}
              onClick={() => onChange(dishes.filter((x) => x !== d))}
              className="fm-tag fm-tag-dish"
              style={{ cursor: 'pointer' }}
            >
              {d} <span style={{ opacity: 0.6 }}>✕</span>
            </button>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder="输入招牌菜名，Enter 添加…"
          style={{
            flex: 1,
            background: 'var(--fm-paper)',
            border: '1px solid var(--fm-line-2)',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: '1rem',
            fontFamily: 'var(--font-geist-sans)',
            color: 'var(--fm-ink)',
            outline: 'none',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--fm-ink)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--fm-line-2)')}
        />
        <button
          onClick={add}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            fontSize: 13,
            fontFamily: 'var(--font-geist-sans)',
            background: 'var(--fm-muted)',
            border: '1px solid var(--fm-line-2)',
            color: 'var(--fm-ink-2)',
            cursor: 'pointer',
          }}
        >
          添加
        </button>
      </div>
    </div>
  )
}

function FormSection({ label, children, noMargin }: { label: string; children: React.ReactNode; noMargin?: boolean }) {
  return (
    <div style={{ marginBottom: noMargin ? 0 : 14 }}>
      <p
        style={{
          fontFamily: 'var(--font-geist-mono)',
          fontSize: 10,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--fm-ink-4)',
          fontWeight: 500,
          marginBottom: 8,
        }}
      >
        {label}
      </p>
      {children}
    </div>
  )
}
