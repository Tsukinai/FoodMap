import { NextRequest } from 'next/server'
import { requireOwner } from '@/lib/supabase/server'
import type { DashboardStats } from '../stats/route'

function buildPrompt(stats: DashboardStats): string {
  const costSummary = stats.avgCostMin != null && stats.avgCostMax != null
    ? `SGD ${stats.avgCostMin}–${stats.avgCostMax}/人`
    : stats.avgCostMin != null
      ? `约 SGD ${stats.avgCostMin}/人起`
      : '未知'

  const ratingBreakdown = stats.byRating
    .filter(r => r.count > 0)
    .map(r => `${r.rating}×${r.count}`)
    .join(' ')

  const top5Cuisine = stats.byCuisine.slice(0, 5).map(c => `${c.name}(${c.count})`).join('、')
  const top5Area = stats.byArea.slice(0, 5).map(a => `${a.area}(${a.count})`).join('、')
  const tasteTags = stats.byTaste.map(t => `${t.name}(${t.count})`).join('、') || '暂无'
  const sceneTags = stats.byScene.map(s => `${s.name}(${s.count})`).join('、') || '暂无'

  return `/no_think
你是一位美食分析师。以下是这位食客的记录数据：

总计 ${stats.total} 家（已吃 ${stats.visited}，想吃 ${stats.want}）
人均消费：${costSummary}
评分：${ratingBreakdown || '暂无'}
菜系前5：${top5Cuisine || '暂无'}
常去地区前5：${top5Area || '暂无'}
口味标签：${tasteTags}
场合标签：${sceneTags}

请用中文写 150-200 字的口味偏好分析。要有具体见解。风格简洁直接。`
}

function sseChunk(data: object): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)
}

export async function POST(req: NextRequest) {
  const owner = await requireOwner()
  if (!owner) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { stats } = await req.json() as { stats: DashboardStats }
  const prompt = buildPrompt(stats)

  const ollamaBase = process.env.OLLAMA_PROXY_URL ?? ''
  const ollamaKey = process.env.OLLAMA_API_KEY

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => controller.enqueue(sseChunk(data))
      try {
        const ollamaRes = await fetch(`${ollamaBase}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(ollamaKey ? { Authorization: `Bearer ${ollamaKey}` } : {}),
          },
          body: JSON.stringify({
            model: 'qwen3-agent:latest',
            messages: [{ role: 'user', content: prompt }],
            think: false,
            stream: true,
            options: { num_predict: 600, temperature: 0.6 },
          }),
        })

        if (!ollamaRes.ok || !ollamaRes.body) {
          send({ type: 'error', message: 'LLM 服务不可达' })
          send({ type: 'done' })
          return
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
              if (piece) send({ type: 'delta', content: piece })
            } catch { /* skip malformed */ }
          }
        }
        send({ type: 'done' })
      } catch (err) {
        console.error('[ai-summary] error:', err)
        send({ type: 'error', message: '分析失败，请稍后再试' })
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
