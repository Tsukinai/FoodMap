import { DEFAULT_MODEL } from '@/lib/llm'

export async function GET() {
  const base = process.env.OLLAMA_PROXY_URL
  if (!base) {
    return Response.json({ ok: false, error: 'OLLAMA_PROXY_URL not set' }, { status: 500 })
  }

  try {
    const res = await fetch(`${base}/api/show`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.OLLAMA_API_KEY ? { Authorization: `Bearer ${process.env.OLLAMA_API_KEY}` } : {}),
      },
      body: JSON.stringify({ name: DEFAULT_MODEL }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      return Response.json({ ok: false, error: `model not found (${res.status})` })
    }
    return Response.json({ ok: true })
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'unreachable' })
  }
}
