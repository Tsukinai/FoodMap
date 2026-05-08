// LLM model name. Both Stage A (intent extraction) and Stage C (writing) in
// /api/recommend talk to Ollama's native /api/chat directly so `think: false`
// is honored — the OpenAI-compat endpoint silently drops unknown fields,
// which left Qwen3 in reasoning mode and made Stage A ~5x slower.
export const LLM_MODEL = 'qwen3:14b-q4_K_M'
