import { NextRequest, NextResponse } from 'next/server'
import type { Tag } from '@/lib/types'

const NIM_BASE = 'https://integrate.api.nvidia.com/v1'
const MODEL = 'minimax/MiniMax-Text-01'

const filterSchema = {
  type: 'function',
  function: {
    name: 'apply_filter',
    description: 'Apply structured search filters to the restaurant map based on the user query',
    parameters: {
      type: 'object',
      properties: {
        cuisine_tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Cuisine tag names to filter by. Empty array means no cuisine filter.',
        },
        dish_tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Dish tag names to filter by. Empty array means no dish filter.',
        },
        taste_tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Taste tag names (e.g. 辣, 清淡). Empty array means no taste filter.',
        },
        min_cost: {
          type: 'number',
          description: 'Minimum cost per person in SGD. Omit if no minimum.',
        },
        max_cost: {
          type: 'number',
          description: 'Maximum cost per person in SGD. Omit if no maximum.',
        },
        area_keyword: {
          type: 'string',
          description: 'Area or landmark keyword to search in address. Omit if no location filter.',
        },
        regions: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['中部', '东部', '西部', '北部', '东北部', 'CBD/滨海湾', '牛车水', '小印度', '甘榜格南'],
          },
          description: 'Singapore regions to filter by. Empty array means all regions.',
        },
      },
      required: ['cuisine_tags', 'dish_tags', 'taste_tags', 'regions'],
    },
  },
}

export async function POST(request: NextRequest) {
  const { query, availableTags } = await request.json()
  if (!query) return NextResponse.json({ error: 'Missing query' }, { status: 400 })

  const apiKey = process.env.NVIDIA_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'NVIDIA_API_KEY not configured' }, { status: 500 })

  const cuisineTags: Tag[] = (availableTags ?? []).filter((t: Tag) => t.type === 'cuisine')
  const dishTags: Tag[] = (availableTags ?? []).filter((t: Tag) => t.type === 'dish')
  const tasteTags: Tag[] = (availableTags ?? []).filter((t: Tag) => t.type === 'taste')

  const systemPrompt = `你是新加坡美食地图的筛选助手。
把用户的自然语言查询转换为结构化筛选参数。

可用菜系标签：${cuisineTags.map((t) => `"${t.name}"`).join('、') || '暂无'}
可用菜品标签：${dishTags.map((t) => `"${t.name}"`).join('、') || '暂无'}
可用口味标签：${tasteTags.map((t) => `"${t.name}"`).join('、') || '辣、清淡、甜、咸鲜、酸、鲜香、浓郁、爽口、烟熏'}

新加坡区域：中部、东部、西部、北部、东北部、CBD/滨海湾、牛车水、小印度、甘榜格南
预算参考："便宜"≈ S$15以下，"中等"≈ S$15–40，"贵"≈ S$40以上。
只使用以上列表中的标签名，不要自造标签。
必须调用 apply_filter，即使查询模糊（未约束字段用空数组）。`

  const res = await fetch(`${NIM_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query },
      ],
      tools: [filterSchema],
      tool_choice: { type: 'function', function: { name: 'apply_filter' } },
      max_tokens: 512,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ error: `NIM error: ${text}` }, { status: 500 })
  }

  const data = await res.json()
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0]
  if (!toolCall) return NextResponse.json({ error: 'NIM did not return filter' }, { status: 500 })

  const parsed = JSON.parse(toolCall.function.arguments)
  return NextResponse.json(parsed)
}
