/**
 * 跑 tests/recommend-golden.json 里的 query 打 recall@8。
 *
 * 用法：
 *   1. 启动 dev server: npm run dev
 *   2. 浏览器登录后，DevTools → Application → Cookies 复制全部 cookie 字符串
 *   3. RECOMMEND_EVAL_COOKIE='复制的 cookie' npm run eval:recommend
 */
import fs from 'node:fs'
import path from 'node:path'

interface GoldenEntry {
  query: string
  expected_ids: string[]
  notes?: string
}

interface Timing {
  stage_a_ms: number
  resolve_ms: number
  stage_b_ms?: number
  stage_c_ttft_ms?: number | null
  stage_c_total_ms?: number
  total_ms: number
}

interface RunResult {
  query: string
  expected: string[]
  matched: string[]
  recall: number
  hits: number
  timing: Timing | null
  outcome: string | null
}

const BASE_URL = process.env.RECOMMEND_EVAL_URL ?? 'http://localhost:3001'
const COOKIE = process.env.RECOMMEND_EVAL_COOKIE
if (!COOKIE) {
  console.error('需要 RECOMMEND_EVAL_COOKIE 环境变量。从浏览器 DevTools 复制登录后的 cookie 字符串。')
  process.exit(1)
}

const goldenPath = path.join(process.cwd(), 'tests/recommend-golden.json')
const golden = JSON.parse(fs.readFileSync(goldenPath, 'utf-8')) as GoldenEntry[]

async function runOne(query: string): Promise<{ matched: string[]; timing: Timing | null; outcome: string | null }> {
  const res = await fetch(`${BASE_URL}/api/recommend`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: COOKIE!,
    },
    body: JSON.stringify({ messages: [{ role: 'user', content: query }] }),
  })
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} ${await res.text().catch(() => '')}`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let matched: string[] = []
  let timing: Timing | null = null
  let outcome: string | null = null
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const data = JSON.parse(line.slice(6))
        if (data.type === 'meta') matched = data.restaurant_ids ?? []
        if (data.type === 'done') {
          timing = data.timing ?? null
          outcome = data.outcome ?? null
          return { matched, timing, outcome }
        }
      } catch { /* ignore malformed */ }
    }
  }
  return { matched, timing, outcome }
}

const results: RunResult[] = []
for (const entry of golden) {
  process.stdout.write(`▸ ${entry.query} ... `)
  try {
    const { matched, timing, outcome } = await runOne(entry.query)
    const expectedSet = new Set(entry.expected_ids)
    const hits = matched.filter(id => expectedSet.has(id)).length
    const recall = entry.expected_ids.length > 0 ? hits / entry.expected_ids.length : NaN
    results.push({ query: entry.query, expected: entry.expected_ids, matched, recall, hits, timing, outcome })
    const t = timing
      ? ` [a=${timing.stage_a_ms} r=${timing.resolve_ms} b=${timing.stage_b_ms ?? '-'} ttft=${timing.stage_c_ttft_ms ?? '-'} c=${timing.stage_c_total_ms ?? '-'} tot=${timing.total_ms}]`
      : ''
    if (entry.expected_ids.length === 0) {
      console.log(`(无期望) matched=${matched.length}${t}`)
    } else {
      console.log(`recall=${recall.toFixed(2)} (${hits}/${entry.expected_ids.length})${t}`)
    }
  } catch (e) {
    console.log(`ERROR: ${e instanceof Error ? e.message : e}`)
    results.push({ query: entry.query, expected: entry.expected_ids, matched: [], recall: 0, hits: 0, timing: null, outcome: null })
  }
}

const scored = results.filter(r => r.expected.length > 0)
if (scored.length > 0) {
  const avg = scored.reduce((s, r) => s + r.recall, 0) / scored.length
  const zero = scored.filter(r => r.recall === 0).length
  console.log('\n──────────────')
  console.log(`总 query: ${results.length} (有期望: ${scored.length})`)
  console.log(`平均 recall@8: ${avg.toFixed(3)}`)
  console.log(`零召回: ${zero}/${scored.length}`)
} else {
  console.log('\n──────────────')
  console.log(`总 query: ${results.length}（golden set 没填 expected_ids，跳过 recall）`)
}

// ─── timing summary ──────────────────────────────────────────────────────────
const timed = results.filter((r): r is RunResult & { timing: Timing } => r.timing !== null)
if (timed.length > 0) {
  const pct = (xs: number[], p: number) => {
    const sorted = [...xs].sort((a, b) => a - b)
    const i = Math.min(sorted.length - 1, Math.floor(sorted.length * p))
    return sorted[i]
  }
  const stat = (label: string, vals: number[]) => {
    if (vals.length === 0) return
    const avg = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length)
    console.log(`  ${label.padEnd(18)} avg=${avg.toString().padStart(5)}  p50=${pct(vals, 0.5).toString().padStart(5)}  p90=${pct(vals, 0.9).toString().padStart(5)}  max=${Math.max(...vals).toString().padStart(5)}  ms`)
  }
  console.log('\n时间分布 (n=' + timed.length + ')：')
  stat('stage_a (LLM tool)', timed.map(r => r.timing.stage_a_ms))
  stat('resolve (geo)',      timed.map(r => r.timing.resolve_ms))
  stat('stage_b (db+rank)',  timed.map(r => r.timing.stage_b_ms ?? 0).filter(v => v > 0))
  stat('stage_c TTFT',       timed.map(r => r.timing.stage_c_ttft_ms ?? 0).filter(v => v > 0))
  stat('stage_c total',      timed.map(r => r.timing.stage_c_total_ms ?? 0).filter(v => v > 0))
  stat('total',              timed.map(r => r.timing.total_ms))
}
