// Models available to /api/recommend. Both Stage A (intent extraction) and
// Stage C (writing) use Ollama's native /api/chat so `think: false` is
// honored — the OpenAI-compat endpoint silently drops unknown fields.
export const AVAILABLE_MODELS = [
  { id: 'qwen3:14b-q4_K_M',     short: 'Qwen3 14B（快）', label: 'Qwen3 14B（快）' },
  { id: 'qwen3.6:35b-a3b-q8_0', short: 'Qwen3.6 35B（更准）', label: 'Qwen3.6 35B（更准）' },
] as const

export type AvailableModelId = typeof AVAILABLE_MODELS[number]['id']

export const DEFAULT_MODEL: AvailableModelId = 'qwen3:14b-q4_K_M'

// Whitelist guard so an arbitrary `model` field in the request body can't
// route to whatever else the Ollama proxy happens to have loaded.
export function resolveModel(input: unknown): AvailableModelId {
  if (typeof input === 'string' && AVAILABLE_MODELS.some(m => m.id === input)) {
    return input as AvailableModelId
  }
  return DEFAULT_MODEL
}
