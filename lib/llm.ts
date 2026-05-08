import OpenAI from 'openai'

export const llm = new OpenAI({
  baseURL: `${process.env.OLLAMA_PROXY_URL}/v1`,
  apiKey: process.env.OLLAMA_API_KEY ?? 'ollama',
})

export const LLM_MODEL = 'qwen3:14b-q4_K_M'
