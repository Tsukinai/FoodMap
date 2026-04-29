import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { Tag } from '@/lib/types'

const client = new Anthropic()

const filterTool: Anthropic.Tool = {
  name: 'apply_filter',
  description: 'Apply structured search filters to the restaurant map based on the user query',
  input_schema: {
    type: 'object' as const,
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
      min_cost: {
        type: 'number',
        description: 'Minimum cost per person in SGD. Null if no minimum.',
      },
      max_cost: {
        type: 'number',
        description: 'Maximum cost per person in SGD. Null if no maximum.',
      },
      area_keyword: {
        type: 'string',
        description: 'Area or landmark keyword to search in address. Null if no location filter.',
      },
      regions: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['Central', 'East', 'West', 'North', 'North-East'],
        },
        description: 'Singapore regions to filter by. Empty array means all regions.',
      },
    },
    required: ['cuisine_tags', 'dish_tags', 'regions'],
  },
}

export async function POST(request: NextRequest) {
  const { query, availableTags } = await request.json()

  if (!query) return NextResponse.json({ error: 'Missing query' }, { status: 400 })

  const cuisineTags: Tag[] = (availableTags ?? []).filter((t: Tag) => t.type === 'cuisine')
  const dishTags: Tag[] = (availableTags ?? []).filter((t: Tag) => t.type === 'dish')

  const systemPrompt = `You are a filter assistant for a Singapore restaurant map.
Convert the user's natural language query into structured filter parameters.

Available cuisine tags: ${cuisineTags.map((t) => `"${t.name}"`).join(', ') || 'none yet'}
Available dish tags: ${dishTags.map((t) => `"${t.name}"`).join(', ') || 'none yet'}

Singapore regions: Central, East, West, North, North-East
Budget context: "cheap" ≈ under $15, "mid-range" ≈ $15–$40, "expensive" ≈ over $40.
Only use tag names from the available lists above. Do not invent tags.
Always call apply_filter, even for vague queries (use empty arrays for unconstrained fields).`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: systemPrompt,
    tools: [filterTool],
    tool_choice: { type: 'any' },
    messages: [{ role: 'user', content: query }],
  })

  const toolUse = response.content.find((b) => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    return NextResponse.json({ error: 'LLM did not return filter' }, { status: 500 })
  }

  return NextResponse.json(toolUse.input)
}
