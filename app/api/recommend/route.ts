import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { llm, LLM_MODEL } from '@/lib/llm'
import {
  filterByTagType,
  parseEWKBPoint,
  haversineKm,
  partitionKnownTagNames,
  expandCuisineTagNames,
} from '@/lib/filter'
import { resolveLocation, type ResolvedLocation } from '@/lib/locationResolve'
import type { Restaurant, Tag, TagType } from '@/lib/types'

interface DbTag {
  id: string; name: string; type: string; parent_id: string | null; sort_order: number; created_at: string
}
interface DbRow {
  id: string; name: string; address: string | null; postal_code: string | null
  planning_area: string | null; location: string | null
  cost_min: number | null; cost_max: number | null
  notes: string | null; signature_dishes: string[]
  status: string; rating: string; created_at: string; updated_at: string
  restaurant_tags: Array<{ tags: DbTag | null }>
}

const SEARCH_TOOL = {
  type: 'function' as const,
  function: {
    name: 'search_restaurants',
    description: '根据用户意图提取餐馆搜索条件，必须调用此工具',
    parameters: {
      type: 'object',
      properties: {
        cuisine_tags: {
          type: 'array', items: { type: 'string' },
          description: '菜系标签，仅从系统提供的可用列表中选取',
        },
        dish_tags: {
          type: 'array', items: { type: 'string' },
          description: '菜品标签，仅从系统提供的可用列表中选取',
        },
        taste_tags: {
          type: 'array', items: { type: 'string' },
          description: '口味标签，仅从系统提供的可用列表中选取',
        },
        scene_tags: {
          type: 'array', items: { type: 'string' },
          description: '场景标签，仅从系统提供的可用列表中选取',
        },
        max_cost: { type: 'number', description: '最高人均消费（SGD）' },
        min_cost: { type: 'number', description: '最低人均消费（SGD）' },
        status: {
          type: 'string', enum: ['want', 'visited'],
          description: 'want=还没去过的，visited=已去过的。不限制则不填',
        },
        ratings: {
          type: 'array', items: { type: 'string', enum: ['夯', '顶级', '人上人', 'NPC', '拉完了'] },
          description: '按评分筛选。夯=最好，拉完了=最差',
        },
        location_query: {
          type: 'string',
          description: '用户提到的任何地名（街区、大区、方位、planning area、地标、商场、MRT 站），原样填进来。不要分类、不要拆分，由代码统一解析',
        },
        radius_km: {
          type: 'number',
          description: '半径提示，仅当 location_query 是具体地点时生效。"附近"=2，"周围"=3。说"中部"或具体街区时不必填',
        },
      },
    },
  },
}

function buildSystemPrompt(tags: Tag[]): string {
  const by = (t: string) => tags.filter(tag => tag.type === t).map(tag => tag.name).join('、') || '（暂无）'
  return `/no_think
你是食迹的新加坡美食地图搜索助手。必须调用 search_restaurants 工具提取条件，不要直接答用户。

【标签—只能从以下列表选，不要造】
菜系：${by('cuisine')}
菜品：${by('dish')}
口味：${by('taste')}
场景：${by('scene')}

【评分】夯/顶级/人上人/NPC/拉完了

【location_query】只要用户提到任何地名（街区、大区、方位、planning area、地标、商场、MRT 站），原样填进 location_query。不要分类、不要选 planning area、不要翻译——代码会统一解析。
- "中部"/"东边"/"西部" → location_query: "中部" / "东边" / "西部"
- "Clementi"/"Tampines"/"Orchard" → location_query: 原样
- "Vivocity"/"ION Orchard"/"Marina Bay Sands" → location_query: 原样
- "Bugis"/"Holland Village"/"Tiong Bahru"/"牛车水" → location_query: 原样
没提地名就留空。

【radius_km】仅当 location_query 是具体地点（地标/MRT/街区）时填。"附近"=2，"周围"=3。说大区或 planning area 时不必填。

【常见示例】
- "想吃牛排，中部吧" → cuisine_tags: ["西餐"], dish_tags: ["牛排"], location_query: "中部"
- "Clementi 附近想吃中餐" → cuisine_tags: ["中餐"], location_query: "Clementi"
- "便宜的辣的，还没去过" → taste_tags: ["特辣"], max_cost: 25, status: "want"
- "Vivocity 附近随便吃点" → location_query: "Vivocity", radius_km: 2`
}

function sseChunk(data: object): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { messages } = await req.json()
  const lastUserMessage: string | null =
    [...messages].reverse().find((m: { role: string }) => m.role === 'user')?.content ?? null

  const { data: tagsData } = await supabase.from('tags').select('*').order('sort_order')
  const allTags: Tag[] = (tagsData ?? []) as Tag[]

  // Set of planning areas with actual restaurant data — used by resolveLocation
  // to filter region expansion and exact-match lookup. Not surfaced to the LLM
  // anymore; the resolver handles it deterministically.
  const { data: areasData } = await supabase
    .from('restaurants')
    .select('planning_area')
    .not('planning_area', 'is', null)
  const availableAreas: string[] = Array.from(
    new Set(((areasData ?? []) as { planning_area: string | null }[])
      .map(r => r.planning_area)
      .filter((a): a is string => !!a))
  ).sort()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => controller.enqueue(sseChunk(data))

      try {
        // ── Stage A: intent understanding ──
        send({ type: 'stage', stage: 'understanding' })

        const stageAStart = Date.now()
        let intentResult
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          intentResult = await (llm.chat.completions.create as any)({
            model: LLM_MODEL,
            messages: [
              { role: 'system', content: buildSystemPrompt(allTags) },
              ...messages.map((m: { role: string; content: string }) => ({
                role: m.role as 'user' | 'assistant',
                content: m.content,
              })),
            ],
            tools: [SEARCH_TOOL],
            tool_choice: { type: 'function', function: { name: 'search_restaurants' } },
            stream: false,
            max_tokens: 256,
            temperature: 0.2,
            think: false,
          })
        } catch {
          send({ type: 'error', message: 'LLM 服务不可达，请检查网络或本地 Ollama 状态' })
          send({ type: 'done' })
          return
        }
        const stageAMs = Date.now() - stageAStart

        const rawToolCall = intentResult.choices[0]?.message?.tool_calls?.[0]
        const toolCall = rawToolCall?.type === 'function' ? rawToolCall : undefined
        const args = toolCall ? JSON.parse(toolCall.function.arguments) : {}

        // Drop unknown tag names (LLM hallucinations) so they don't silently
        // zero-out results. Expand cuisine parent → children since tag match is
        // exact-name: "中餐" must also pull in 粤菜/川菜/...
        const validate = (raw: unknown, type: TagType) =>
          partitionKnownTagNames(Array.isArray(raw) ? raw : [], type, allTags)
        const cuisine_v = validate(args.cuisine_tags, 'cuisine')
        const dish_v    = validate(args.dish_tags,    'dish')
        const taste_v   = validate(args.taste_tags,   'taste')
        const scene_v   = validate(args.scene_tags,   'scene')

        const droppedTags = [
          ...cuisine_v.dropped, ...dish_v.dropped,
          ...taste_v.dropped, ...scene_v.dropped,
        ]

        const cuisine_tags: string[] = expandCuisineTagNames(cuisine_v.kept, allTags)
        const dish_tags: string[]    = dish_v.kept
        const taste_tags: string[]   = taste_v.kept
        const scene_tags: string[]   = scene_v.kept
        const ratings: string[]      = args.ratings ?? []
        const max_cost: number | undefined = args.max_cost
        const min_cost: number | undefined = args.min_cost
        const status: string | undefined   = args.status
        const location_query: string | undefined = args.location_query
        const radius_km_hint: number | undefined = args.radius_km

        // Single resolution path: planning-area exact match → region keyword →
        // OneMap geocode + radius. Replaces the LLM-driven areas/near_location
        // split, which silently dropped non-planning-area neighborhood names.
        let resolved: ResolvedLocation | null = null
        if (typeof location_query === 'string' && location_query.trim()) {
          resolved = await resolveLocation(location_query, availableAreas, {
            radiusHint: radius_km_hint,
          })
        }

        // No constraint at all — either the LLM dropped the tool call (rare now
        // that tool_choice is forced) or every extracted field was empty/dropped.
        // Returning the DB's first 8 rows here would be noise; ask the user to
        // pick a dimension instead.
        const hasAnyConstraint =
          cuisine_tags.length > 0 || dish_tags.length > 0 ||
          taste_tags.length > 0   || scene_tags.length > 0 ||
          ratings.length > 0      || resolved !== null ||
          max_cost != null || min_cost != null ||
          status != null

        if (!hasAnyConstraint) {
          console.log(JSON.stringify({
            evt: 'recommend',
            ts: new Date().toISOString(),
            query: lastUserMessage,
            raw_args: args,
            normalized: { cuisine_tags, dish_tags, taste_tags, scene_tags, max_cost, min_cost, status, ratings, location_query, resolved, radius_km_hint },
            dropped_tags: droppedTags,
            outcome: 'clarify',
            stage_a_ms: stageAMs,
          }))
          send({
            type: 'meta',
            restaurant_ids: [],
            filter: {
              cuisine_tags, dish_tags, taste_tags, scene_tags,
              location: null,
              max_cost: max_cost ?? null,
              min_cost: min_cost ?? null,
              status: status ?? null,
              ratings,
            },
          })
          send({ type: 'stage', stage: 'writing' })
          send({
            type: 'delta',
            content: '想吃什么？给我一个方向就行——菜系（中餐/日料/西餐…）、区域（Clementi/Orchard…）、预算或口味，任选一个。',
          })
          send({ type: 'done' })
          return
        }

        // ── Stage B: query and filter ──
        send({ type: 'stage', stage: 'searching' })

        let query = supabase
          .from('restaurants')
          .select(`
            id, name, address, postal_code, planning_area, location,
            cost_min, cost_max, notes, signature_dishes, status, rating,
            created_at, updated_at,
            restaurant_tags ( tags ( id, name, type, parent_id, sort_order, created_at ) )
          `)

        if (max_cost != null) query = query.lte('cost_max', max_cost)
        if (min_cost != null) query = query.gte('cost_min', min_cost)
        if (status)           query = query.eq('status', status)
        if (resolved?.kind === 'areas') query = query.in('planning_area', resolved.areas)

        const { data: rawData } = await query

        let results: Restaurant[] = ((rawData ?? []) as unknown as DbRow[]).map(r => {
          const coords = typeof r.location === 'string' ? parseEWKBPoint(r.location) : null
          return {
            id: r.id, name: r.name, address: r.address, postal_code: r.postal_code,
            planning_area: r.planning_area,
            location_lng: coords?.[0] ?? 0,
            location_lat: coords?.[1] ?? 0,
            cost_min: r.cost_min, cost_max: r.cost_max, notes: r.notes,
            signature_dishes: r.signature_dishes ?? [],
            status: r.status as Restaurant['status'],
            rating: r.rating as Restaurant['rating'],
            created_at: r.created_at, updated_at: r.updated_at,
            tags: (r.restaurant_tags ?? []).map(rt => rt.tags).filter((t): t is DbTag => Boolean(t)) as Tag[],
          }
        })

        let refLat: number | null = null
        let refLng: number | null = null
        let activeRadius: number | null = null

        if (resolved?.kind === 'point') {
          refLat = resolved.lat
          refLng = resolved.lng
          activeRadius = resolved.radius_km
          results = results.filter(r =>
            haversineKm(refLat!, refLng!, r.location_lat, r.location_lng) <= activeRadius!
          )
        }

        results = filterByTagType(results, cuisine_tags, 'cuisine')
        results = filterByTagType(results, dish_tags,    'dish')
        results = filterByTagType(results, taste_tags,   'taste')
        results = filterByTagType(results, scene_tags,   'scene')

        if (ratings.length > 0) {
          results = results.filter(r => ratings.includes(r.rating))
        }

        // Rank: rating × 3 (dominant) + number of tag-type hits + proximity
        // score (only when near_location), tie-break by created_at desc. Without
        // this, slice(0, 8) was returning whatever order Supabase emitted.
        const RATING_SCORE: Record<string, number> = {
          '夯': 5, '顶级': 4, '人上人': 3, 'NPC': 2, '拉完了': 1, '未评分': 0,
        }
        const tagHitTypes = (r: Restaurant) => {
          let n = 0
          if (cuisine_tags.length && cuisine_tags.some(name => r.tags.some(t => t.name === name && t.type === 'cuisine'))) n++
          if (dish_tags.length    && dish_tags.some(name    => r.tags.some(t => t.name === name && t.type === 'dish')))    n++
          if (taste_tags.length   && taste_tags.some(name   => r.tags.some(t => t.name === name && t.type === 'taste')))   n++
          if (scene_tags.length   && scene_tags.some(name   => r.tags.some(t => t.name === name && t.type === 'scene')))   n++
          return n
        }
        const score = (r: Restaurant) => {
          const ratingPart = (RATING_SCORE[r.rating] ?? 0) * 3
          const tagPart = tagHitTypes(r)
          let distPart = 0
          if (refLat !== null && refLng !== null && activeRadius !== null) {
            const d = haversineKm(refLat, refLng, r.location_lat, r.location_lng)
            distPart = Math.max(0, (activeRadius - d) / activeRadius)
          }
          return ratingPart + tagPart + distPart
        }
        results.sort((a, b) => {
          const diff = score(b) - score(a)
          if (diff !== 0) return diff
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })

        const matched = results.slice(0, 8)

        console.log(JSON.stringify({
          evt: 'recommend',
          ts: new Date().toISOString(),
          query: lastUserMessage,
          raw_args: args,
          normalized: { cuisine_tags, dish_tags, taste_tags, scene_tags, max_cost, min_cost, status, ratings, location_query, resolved, radius_km_hint },
          dropped_tags: droppedTags,
          candidate_count: results.length,
          matched_ids: matched.map(r => r.id),
          outcome: matched.length > 0 ? 'matched' : 'no_match',
          stage_a_ms: stageAMs,
        }))

        send({
          type: 'meta',
          restaurant_ids: matched.map(r => r.id),
          filter: {
            cuisine_tags, dish_tags, taste_tags, scene_tags,
            location: resolved,
            max_cost: max_cost ?? null,
            min_cost: min_cost ?? null,
            status: status ?? null,
            ratings,
          },
        })

        // ── Stage C: stream recommendation text ──
        send({ type: 'stage', stage: 'writing' })

        const restaurantCtx = matched.map((r, i) => {
          const tags  = r.tags.map(t => t.name).join('、')
          const cost  = r.cost_min != null && r.cost_max != null ? ` SGD ${r.cost_min}–${r.cost_max}/人` : ''
          const dishes = r.signature_dishes.length > 0 ? ` 招牌：${r.signature_dishes.join('、')}。` : ''
          const area  = r.planning_area ? ` 位置：${r.planning_area}。` : ''
          const rating = r.rating && r.rating !== '未评分' ? ` 评分：${r.rating}。` : ''
          const note  = r.notes ? ` 我的评价：${r.notes}` : ''
          return `${i + 1}. ${r.name}（${tags}）${cost}${rating}${area}${dishes}${note}`
        }).join('\n')

        const filterSummary = (() => {
          const parts: string[] = []
          if (cuisine_tags.length) parts.push(`菜系=${cuisine_tags.join('/')}`)
          if (dish_tags.length)    parts.push(`菜品=${dish_tags.join('/')}`)
          if (taste_tags.length)   parts.push(`口味=${taste_tags.join('/')}`)
          if (scene_tags.length)   parts.push(`场景=${scene_tags.join('/')}`)
          if (resolved?.kind === 'areas') {
            const display = resolved.areas.length > 3
              ? `${resolved.label}（${resolved.areas.slice(0, 3).join('/')}…）`
              : resolved.areas.join('/')
            parts.push(`区域=${display}`)
          } else if (resolved?.kind === 'point') {
            const where = resolved.planning_area
              ? `${resolved.label}（${resolved.planning_area}）`
              : resolved.label
            parts.push(`地点=${where} 附近 ${resolved.radius_km}km`)
          } else if (location_query) {
            parts.push(`地点=${location_query}（未识别）`)
          }
          if (min_cost != null && max_cost != null) parts.push(`预算 ${min_cost}–${max_cost} SGD`)
          else if (max_cost != null) parts.push(`预算 ≤${max_cost} SGD`)
          else if (min_cost != null) parts.push(`预算 ≥${min_cost} SGD`)
          if (status === 'want')    parts.push('仅未去过')
          if (status === 'visited') parts.push('仅已去过')
          if (ratings.length)       parts.push(`评分=${ratings.join('/')}`)
          return parts.length === 0 ? '（用户没指定具体条件）' : parts.join('，')
        })()

        const recommendSystem = matched.length > 0
          ? `/no_think
你刚帮用户在他自己的新加坡美食地图里筛出了 ${matched.length} 家餐馆，下面是这些餐馆的资料。
用 2-3 句自然中文回应用户的需求，写成对话语气。

用户筛选条件：${filterSummary}
匹配结果：${matched.length} 家

要求：
- 不要照抄"我的评价"原文，用自己的话提炼一两个亮点
- 只 1 家就突出这家的特色和你为啥推荐它
- 多家就分类对比，比如"如果想 X 选 A，想 Y 选 B"
- 不要列编号、bullet、表情符号
- 不要重复用户原话
- 评分参考：夯=最高，顶级>人上人>NPC>拉完了

候选餐馆：
${restaurantCtx}`
          : `/no_think
用户筛选条件：${filterSummary}
匹配结果：0 家

用一句话告诉用户没匹配，然后从上面的筛选条件里挑一个最可能是瓶颈的维度（区域太冷？预算太紧？菜系太具体？）给出一条具体的放宽建议——直接说"把 X 改成 Y" 或 "去掉 X 限制"，不要泛泛的"换个菜系"。不要废话，不要列表。`

        let received = 0
        try {
          // Use Ollama native /api/chat — `/v1/chat/completions` (OpenAI compat) drops
          // unknown fields like `think`, so the model keeps reasoning. Native API
          // honors `think: false` (same flag Open WebUI's `/set parameter think false` sets).
          const baseURL = process.env.OLLAMA_PROXY_URL ?? ''
          const apiKey = process.env.OLLAMA_API_KEY
          const ollamaRes = await fetch(`${baseURL}/api/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
            },
            body: JSON.stringify({
              model: LLM_MODEL,
              messages: [
                { role: 'system', content: recommendSystem },
                ...messages.map((m: { role: string; content: string }) => ({
                  role: m.role,
                  content: m.content,
                })),
              ],
              think: false,
              stream: true,
              options: { num_predict: 600, temperature: 0.6 },
            }),
          })

          if (!ollamaRes.ok || !ollamaRes.body) {
            throw new Error(`Ollama responded ${ollamaRes.status}`)
          }

          const reader = ollamaRes.body.getReader()
          const decoder = new TextDecoder()
          let buf = ''
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buf += decoder.decode(value, { stream: true })
            const lines = buf.split('\n')
            buf = lines.pop() ?? ''
            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed) continue
              try {
                const json = JSON.parse(trimmed)
                const piece: string = json.message?.content ?? ''
                if (piece) {
                  received += piece.length
                  send({ type: 'delta', content: piece })
                }
              } catch { /* skip malformed line */ }
            }
          }
          console.log('[recommend] stream finished, received chars:', received)
        } catch (err) {
          console.error('[recommend] stream error:', err)
        }

        // Last-resort fallback if Ollama returned nothing usable.
        if (received === 0) {
          console.warn('[recommend] empty stream, using full-list fallback')
          const fallback = matched.length === 0
            ? '没找到匹配的餐馆。要不放宽点条件试试？比如换个菜系或扩大范围。'
            : matched.length === 1
              ? `为你找到 ${matched[0].name}。${matched[0].notes ?? matched[0].signature_dishes.slice(0, 2).join('、') ?? ''}`
              : `为你找到 ${matched.length} 家：${matched.map(r => r.name).join('、')}。`
          send({ type: 'delta', content: fallback })
        }

        send({ type: 'done' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
