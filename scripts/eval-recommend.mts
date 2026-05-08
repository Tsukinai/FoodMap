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

interface RunResult {
  query: string
  expected: string[]
  matched: string[]
  recall: number
  hits: number
}

const BASE_URL = process.env.RECOMMEND_EVAL_URL ?? 'http://localhost:3001'
const COOKIE = process.env.RECOMMEND_EVAL_COOKIE
if (!COOKIE) {
  console.error('需要 RECOMMEND_EVAL_COOKIE 环境变量。从浏览器 DevTools 复制登录后的 cookie 字符串。')
  process.exit(1)
}

const goldenPath = path.join(process.cwd(), 'tests/recommend-golden.json')
const golden = JSON.parse(fs.readFileSync(goldenPath, 'utf-8')) as GoldenEntry[]

async function runOne(query: string): Promise<string[]> {
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
        if (data.type === 'done') return matched
      } catch { /* ignore malformed */ }
    }
  }
  return matched
}

const results: RunResult[] = []
for (const entry of golden) {
  process.stdout.write(`▸ ${entry.query} ... `)
  const t0 = Date.now()
  try {
    const matched = await runOne(entry.query)
    const expectedSet = new Set(entry.expected_ids)
    const hits = matched.filter(id => expectedSet.has(id)).length
    const recall = entry.expected_ids.length > 0 ? hits / entry.expected_ids.length : NaN
    results.push({ query: entry.query, expected: entry.expected_ids, matched, recall, hits })
    const ms = Date.now() - t0
    if (entry.expected_ids.length === 0) {
      console.log(`(无期望) matched=${matched.length} ${ms}ms`)
    } else {
      console.log(`recall=${recall.toFixed(2)} (${hits}/${entry.expected_ids.length}) ${ms}ms`)
    }
  } catch (e) {
    console.log(`ERROR: ${e instanceof Error ? e.message : e}`)
    results.push({ query: entry.query, expected: entry.expected_ids, matched: [], recall: 0, hits: 0 })
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
  console.log('\n（golden set 都没填 expected_ids，先去 tests/recommend-golden.json 填上真实餐馆 id）')
}
