# 自然语言餐馆推荐 — 实施计划

## 背景

现有 FoodMap 用结构化 FilterPanel 做筛选（cuisine/dish/taste/scene + 成本 + 状态），用户必须知道有哪些标签、点击勾选。希望接入 LLM，让用户用一句话表达意图（"Clementi 附近想吃中餐或者牛排"），自动转成过滤条件并生成文字推荐。

**结论先行**：

- **不需要 RAG**。RAG 处理的是非结构化文档检索；FoodMap 餐馆数据是结构化的（标签、坐标、成本），LLM 只要做 NLU + tool calling，把自然语言映射到现有 FilterPayload 即可。
- **不需要单独情感分析**。LLM 直接理解意图。`notes` 字段如果以后要"那家氛围浪漫的店"这种语义查询，再加 embedding 检索（V2，本计划不做）。

## 用户决策

- LLM：本地 Ollama，模型 `qwen3:30b-a3b` 或 `qwen3:32b`（用户实际用的是 Qwen3 系列，MoE 版本更快）
- 呈现：右下浮动按钮 → 聊天面板（多轮）+ LLM 文字推荐 + 同步过滤地图/列表
- 距离半径：让 LLM 自己判断（"Clementi 附近"→2km，"西部"→8km）

## 网络访问推荐

办公室 MacBook 部署 Ollama，用 **Tailscale**（免费个人 plan，零配置 P2P）：
- 开发机和 Mac 双端装 Tailscale
- Mac 上启动：`OLLAMA_HOST=0.0.0.0:11434 ollama serve`
- 开发机访问 `http://100.x.x.x:11434`（Tailscale 内网 IP）

Cloudflare Tunnel 也行但要注册域名，更复杂。

## 架构

```
用户在浮动按钮聊天框输入 "Clementi 附近想吃中餐或牛排"
          │
          ▼
POST /api/recommend  { messages: [...] }      ← Next.js server route
          │
          ▼
Ollama (Tailscale)   /v1/chat/completions     ← OpenAI 兼容接口 + tool use
  tools: [search_restaurants]
          │
LLM 输出 tool_call: search_restaurants({
  cuisine_tags: ["中餐"], dish_tags: ["牛排"],
  near_location: "Clementi", radius_km: 2
})
          │
          ▼
server: searchOneMap("Clementi") → [lng, lat]
          │
          ▼
Supabase RPC: search_restaurants_nearby(lng, lat, radius_m, ...)
  使用 ST_DWithin + 标签 join 过滤
          │
          ▼
候选 Restaurant[] → 喂回 Ollama 生成推荐文字
          │
          ▼
返回 { assistant_text, restaurant_ids, filter_summary }
          │
          ▼
HomePage 用 restaurant_ids 高亮地图 + 同步列表过滤
ChatPanel 渲染 LLM 文字气泡
```

## 实施步骤

### Step 1 — Supabase RPC：距离 + 标签过滤

**新增**：`supabase/migrations/0010_search_restaurants_rpc.sql`

```sql
CREATE OR REPLACE FUNCTION search_restaurants_nearby(
  p_lng DOUBLE PRECISION DEFAULT NULL,
  p_lat DOUBLE PRECISION DEFAULT NULL,
  p_radius_m INTEGER DEFAULT NULL,
  p_max_cost INTEGER DEFAULT NULL,
  p_min_cost INTEGER DEFAULT NULL,
  p_status TEXT DEFAULT NULL
) RETURNS SETOF restaurants
```

逻辑：如果 `p_lng/p_lat/p_radius_m` 都给了，加 `ST_DWithin(location, ST_Point(p_lng, p_lat)::geography, p_radius_m)`；否则不过滤。GIST 索引已存在（migration 0001 行 30），自动用上。

**标签过滤**仍然在 JS 端做，复用 `app/api/restaurants/route.ts:33-38` 的 `filterByTagType()`，避免改 RPC 复杂度。

**为什么用 RPC 而不是直接拼 SQL**：supabase-js 不支持 PostGIS geography 函数；RPC 是 Supabase 官方推荐方式。

### Step 2 — LLM 客户端封装

**新增**：`lib/llm.ts`

用 `openai` npm 包（Ollama 兼容 OpenAI 接口，最稳）：

```typescript
import OpenAI from "openai"
export const llm = new OpenAI({
  baseURL: process.env.LLM_BASE_URL,   // http://100.x.x.x:11434/v1
  apiKey: "ollama",                     // 占位
})
export const LLM_MODEL = process.env.LLM_MODEL ?? "qwen3:30b-a3b"
```

**新增依赖**：`npm i openai`

### Step 3 — 推荐 API 路由

**新增**：`app/api/recommend/route.ts`

接收 `POST { messages: ChatMessage[] }`，分三阶段：

**阶段 A：意图理解**（LLM tool call）
- 给 LLM 一个 `search_restaurants` tool，参数对应现有 `FilterPayload` 字段 + `near_location` + `radius_km`
- system prompt 告诉它：可用 cuisine/dish/taste/scene 标签从数据库实时拉（启动时查 `tags` 表，作为枚举值塞进 tool description，避免 LLM 编造不存在的标签）
- 让 LLM 也判断 `radius_km`（默认值规则写在 prompt 里）

**阶段 B：执行查询**
- 如果 `near_location` 非空：调用现有 `searchOneMap()`（`lib/onemap.ts`）转坐标
- 调用 Supabase RPC `search_restaurants_nearby`
- JS 端按标签过滤（复用现有 `filterByTagType` 逻辑，从 `app/api/restaurants/route.ts` 抽到 `lib/filter.ts`）

**阶段 C：生成推荐文字**
- 把命中的餐馆（最多 8 个，含 name/notes/signature_dishes/cost_min/cost_max/tags）喂回 Ollama
- 让 LLM 生成 2-3 句中文推荐
- 返回 `{ message: "...", restaurant_ids: [...], filter: {...} }`

**Token 预算**：
- 系统 prompt + tool schema：~800 tokens
- 标签枚举（约 50 个）：~300 tokens
- 候选餐馆 8 个：~1500 tokens
- 总输入 < 3K，Qwen3 上下文足够

### Step 4 — 前端：浮动按钮 + 聊天面板

**新增**：
- `components/recommend/RecommendFab.tsx`：右下角悬浮按钮（圆形，AI 图标）
- `components/recommend/RecommendChat.tsx`：弹出聊天面板，维护 `messages` 状态，调用 `/api/recommend`

**修改 `app/HomePage.tsx`**：
- 引入 `RecommendFab`
- 加 state `recommendedIds: string[] | null`
- 把 `recommendedIds` 通过 props 传给 `MapContainer` 和 `RestaurantList`，命中的餐馆高亮（其他餐馆变淡或隐藏）
- 复用现有 filter state，让 LLM 返回的 filter 同步到 FilterPanel（用户能看到 LLM 选了哪些标签）

**修改 `components/map/MapContainer.tsx`**：
- 接收 `highlightedIds` prop
- 命中的 pin 加放大/光晕样式（改 `PinMarker.tsx` 加 `isHighlighted` prop）

### Step 5 — 环境变量

**修改 `.env.local.example`**：

```
LLM_BASE_URL=http://100.x.x.x:11434/v1
LLM_MODEL=qwen3:30b-a3b
```

## 关键文件清单

**要修改**：
- `app/HomePage.tsx` — 接收 LLM 推荐结果、传给地图/列表
- `app/api/restaurants/route.ts` — 抽 `filterByTagType` 到 `lib/filter.ts` 复用
- `components/map/MapContainer.tsx` — 高亮推荐 pin
- `components/map/PinMarker.tsx` — 加 highlighted 样式
- `components/RestaurantList.tsx` — 接收高亮 ids，命中的置顶
- `.env.local.example`
- `package.json` — 加 `openai`

**要新增**：
- `supabase/migrations/0010_search_restaurants_rpc.sql`
- `lib/llm.ts`
- `lib/filter.ts`（从 restaurants/route.ts 抽出）
- `app/api/recommend/route.ts`
- `components/recommend/RecommendFab.tsx`
- `components/recommend/RecommendChat.tsx`

## 验证

1. **本地 Ollama 联通**：`curl http://<tailscale-ip>:11434/v1/models` 能返回模型列表
2. **RPC 距离查询**：在 Supabase SQL 编辑器跑 `select count(*) from search_restaurants_nearby(103.7649, 1.3162, 2000)` —— 应返回 Clementi 2km 内餐馆数
3. **API 路由**：`curl -X POST localhost:3000/api/recommend -d '{"messages":[{"role":"user","content":"clementi附近想吃中餐"}]}'` —— 看返回 JSON 是否含 `restaurant_ids` 和 `message`
4. **端到端**：`npm run dev`，点右下浮动按钮，输入测试 query：
   - "Clementi 附近想吃中餐或者牛排" → 地图应只剩 Clementi 2km 内中餐/牛排标签的店
   - "便宜的夜宵" → max_cost 过滤 + scene_tags=["夜宵"]
   - "想吃辣的" → taste_tags=["特辣"] 或包含 ["微辣","特辣"]
   - 多轮："那这家太贵了，换便宜点的" → LLM 在 history 基础上调整 max_cost
5. **失败场景**：
   - LLM 解析不出意图：回 "没听懂，可以说得具体点吗"，不调 tool
   - OneMap 查不到地名：fallback 全岛搜索 + 文字提示
   - Ollama 不可达：API 返回 503，前端显示离线提示

## 取舍说明

- **不抽到 microservice**：直接在 Next.js server route 里调 LLM，本地开发简单。生产再考虑把 LLM 调用移到 Edge Function。
- **不做 streaming**：V1 等完整响应（含数据库查询），延迟约 3-5 秒可接受。后续如果嫌慢，可改成 SSE 流式。
- **不做 embedding/RAG**：餐馆数 < 100，结构化字段够覆盖 90% 查询；notes 语义检索 V2 再加。
- **标签枚举怎么传**：每次请求查 `tags` 表（有 cache 更好，但 Next.js 16 fetch 默认不缓存动态查询）。后续加 `unstable_cache` 或 redis。
