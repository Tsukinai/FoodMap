import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { llm, LLM_MODEL } from '@/lib/llm'
import { searchOneMap } from '@/lib/onemap'
import {
  filterByTagType,
  parseEWKBPoint,
  haversineKm,
  partitionKnownTagNames,
  expandCuisineTagNames,
} from '@/lib/filter'
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
        areas: {
          type: 'array', items: { type: 'string' },
          description: '新加坡 planning area（如 Clementi、Orchard、Tampines）；用户提到具体街区或大区时优先用这个，比 near_location+radius 更准',
        },
        near_location: {
          type: 'string',
          description: '具体地标或建筑名（如 Vivocity、ION Orchard、Changi Airport）。只有用户明确提到具体地点时才填；指代大区时用 areas 而不是这里',
        },
        radius_km: {
          type: 'number',
          description: '配合 near_location 用。"附近"用2，"周围"用3。areas 不需要配 radius',
        },
      },
    },
  },
}

// Singapore planning areas grouped by region — taught to the LLM so 中部/北部
// 等地理范围能映射到一组准确的 planning_area，比 OneMap 单点+半径更靠谱。
const SG_REGIONS = `中部 (Central): Orchard, Newton, Tanglin, Novena, Toa Payoh, Bishan, Bukit Timah, Bukit Merah, Queenstown, Outram, Rochor, Museum, Downtown Core, Marina South, Marina East, River Valley, Singapore River, Kallang, Geylang, Marine Parade
北部 (North): Yishun, Sembawang, Woodlands, Mandai, Central Water Catchment, Lim Chu Kang
东部 (East): Bedok, Tampines, Pasir Ris, Changi, Paya Lebar, Changi Bay
东北部 (Northeast): Ang Mo Kio, Hougang, Sengkang, Punggol, Serangoon, Seletar
西部 (West): Clementi, Jurong East, Jurong West, Bukit Batok, Bukit Panjang, Choa Chu Kang, Boon Lay, Pioneer, Tengah, Tuas
南部 (South): HarbourFront, Bukit Merah, Sentosa, Southern Islands`

function buildSystemPrompt(tags: Tag[], availableAreas: string[]): string {
  const by = (t: string) => tags.filter(tag => tag.type === t).map(tag => tag.name).join('、') || '（暂无）'
  const areaList = availableAreas.length > 0 ? availableAreas.join('、') : '（地图上暂无数据）'
  return `/no_think
你是食迹的新加坡美食地图搜索助手。必须调用 search_restaurants 工具提取条件，不要直接答用户。

【标签—只能从以下列表选，不要造】
菜系：${by('cuisine')}
菜品：${by('dish')}
口味：${by('taste')}
场景：${by('scene')}

【evaluation 评分】夯/顶级/人上人/NPC/拉完了

【地理位置选择规则】
- 用户提到具体地标（Vivocity、ION、Marina Bay Sands 等）→ 用 near_location + radius_km
- 用户提到大区/方位（"中部"、"西部"、"东边"）→ 用 areas，从下面映射表选出对应 planning area，且只挑那些"地图实际有数据"的
- 用户提到具体街区（Clementi、Orchard、Tampines 等）→ 用 areas，只填一个
- 不要把 "中部"、"西部" 这种大区名当成 near_location 传给 OneMap，OneMap 只认得具体地名

【新加坡区域 → planning area 映射】
${SG_REGIONS}

【地图当前实际有餐馆的 planning area】
${areaList}
（areas 参数只挑这里出现过的，没有的不要填，否则会查不到）

【常见映射示例】
- "想吃牛排，中部吧" → cuisine_tags: ["西餐"], dish_tags: ["牛排"], areas: 选若干中部且有数据的 area
- "Clementi 附近想吃中餐" → cuisine_tags: ["中餐"], areas: ["Clementi"]
- "便宜的辣的，还没去过" → taste_tags: ["特辣"], max_cost: 25, status: "want"
- "Vivocity 附近随便吃点" → near_location: "Vivocity", radius_km: 2
- "harbourfront 附近推荐一下" → near_location: "HarbourFront", radius_km: 2
- "Marina Bay Sands 附近" → near_location: "Marina Bay Sands", radius_km: 2
- "Orchard 附近吃日料" → cuisine_tags: ["日料"], near_location: "Orchard", radius_km: 2

【关键】当用户提到任何具体地名（地铁站、商场、街区等），都必须用 near_location 提取出来，绝对不能留空。哪怕你不熟那个地名也要原样填进去，由 OneMap 去识别。`
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
              { role: 'system', content: buildSystemPrompt(allTags, availableAreas) },
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

        // Case-insensitive match against available planning areas
        const areaMap = new Map(availableAreas.map(a => [a.toLowerCase(), a]))
        const normalizeArea = (s: string) => areaMap.get(s.toLowerCase().trim())

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
        const areas: string[] = (args.areas ?? [])
          .map((a: string) => normalizeArea(a))
          .filter((a: string | undefined): a is string => !!a)
        const max_cost: number | undefined = args.max_cost
        const min_cost: number | undefined = args.min_cost
        const status: string | undefined   = args.status
        const near_location: string | undefined = args.near_location
        const radius_km: number | undefined     = args.radius_km

        // No constraint at all — either the LLM dropped the tool call (rare now
        // that tool_choice is forced) or every extracted field was empty/dropped.
        // Returning the DB's first 8 rows here would be noise; ask the user to
        // pick a dimension instead.
        const hasAnyConstraint =
          cuisine_tags.length > 0 || dish_tags.length > 0 ||
          taste_tags.length > 0   || scene_tags.length > 0 ||
          ratings.length > 0      || areas.length > 0 ||
          max_cost != null || min_cost != null ||
          status != null || near_location != null

        if (!hasAnyConstraint) {
          console.log(JSON.stringify({
            evt: 'recommend',
            ts: new Date().toISOString(),
            query: lastUserMessage,
            raw_args: args,
            normalized: { cuisine_tags, dish_tags, taste_tags, scene_tags, areas, max_cost, min_cost, status, ratings, near_location, radius_km },
            dropped_tags: droppedTags,
            outcome: 'clarify',
            stage_a_ms: stageAMs,
          }))
          send({
            type: 'meta',
            restaurant_ids: [],
            filter: {
              cuisine_tags, dish_tags, taste_tags, scene_tags, areas,
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
        if (areas.length > 0) query = query.in('planning_area', areas)

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

        if (near_location) {
          const geo = await searchOneMap(near_location)
          if (geo.length > 0) {
            refLng = parseFloat(geo[0].LONGITUDE)
            refLat = parseFloat(geo[0].LATITUDE)
            activeRadius = radius_km ?? 2
            results = results.filter(r =>
              haversineKm(refLat!, refLng!, r.location_lat, r.location_lng) <= activeRadius!
            )
          }
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
          normalized: { cuisine_tags, dish_tags, taste_tags, scene_tags, areas, max_cost, min_cost, status, ratings, near_location, radius_km },
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
            cuisine_tags, dish_tags, taste_tags, scene_tags, areas,
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
          if (areas.length)        parts.push(`区域=${areas.join('/')}`)
          if (near_location)       parts.push(`地点=${near_location} 附近 ${activeRadius ?? radius_km ?? 2}km`)
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
