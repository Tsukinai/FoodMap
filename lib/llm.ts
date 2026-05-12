export const AVAILABLE_MODELS = [
  { id: 'qwen3-agent:latest', short: 'Qwen3 Agent', label: 'Qwen3 Agent' },
] as const

export type AvailableModelId = typeof AVAILABLE_MODELS[number]['id']

export const DEFAULT_MODEL: AvailableModelId = 'qwen3-agent:latest'

export function resolveModel(input: unknown): AvailableModelId {
  if (typeof input === 'string' && AVAILABLE_MODELS.some(m => m.id === input)) {
    return input as AvailableModelId
  }
  return DEFAULT_MODEL
}
