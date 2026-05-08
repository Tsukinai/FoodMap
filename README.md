# 食迹

> 在新加坡吃了很多顿饭，但有一个很真实的问题——我经常吃完就忘，名字忘，店也忘，只剩下"好像很好吃"这种模糊的幸福感。
>
> 于是就做了这个东西。一半是备忘录，一半是吃货的数据库。

新加坡个人美食地图。记录吃过的、想吃的，按菜系 / 口味 / 场合 / 评分随时筛出来，也能用一句话让 LLM 帮你挑。

## 功能

- 交互式地图，点击添加餐馆 Pin；重叠 Pin 自动展开（spiderfy）
- 餐馆信息：名称、地址（Google Places 搜索 + OneMap 校验）、人均消费、招牌菜、状态（想去 / 已去）、评分（夯 / 顶级 / 人上人 / NPC / 拉完了）、备注、自动归属新加坡 planning area
- 标签系统：菜系（含子菜系层级）、菜品、口味、场合，跨餐馆复用，支持拖拽排序
- 多维筛选：状态、菜系（可展开子菜系）、菜品、口味、场合、人均消费、评分、planning area
- 自然语言推荐：浮动聊天面板，调用本地 Ollama（Qwen3 14B）解析意图、查库、流式生成推荐
- 地图 / 列表 / 留言板三视图，移动端响应式
- PWA：可安装到桌面 / 手机，带离线页
- 留言板：任意 Google 账号登录可留言，本人可回复 / 删除
- Google OAuth 登录，只有本人可编辑餐馆，公开只读

## Tech Stack

| 层         | 技术                                     |
| --------- | -------------------------------------- |
| Framework | Next.js 16 (App Router) + TypeScript   |
| Map       | MapLibre GL + react-map-gl             |
| 地址搜索      | Google Places API (New) + OneMap       |
| LLM       | Ollama + Qwen3 14B Q4_K_M（本地，OpenAI 兼容接口）   |
| 数据库       | Supabase (PostgreSQL + PostGIS + RLS)  |
| 认证        | Supabase Auth + Google OAuth           |
| UI        | Tailwind CSS v4 + shadcn/ui            |
| PWA       | manifest + workbox service worker      |
| 部署        | Vercel                                 |

## 本地运行

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.local.example` 为 `.env.local`，填写：

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# 首次登录后从 Supabase Dashboard > Authentication > Users 获取
NEXT_PUBLIC_OWNER_USER_ID=your-supabase-user-uuid
OWNER_USER_ID=your-supabase-user-uuid

# OneMap（planning area 查询，免费账号）
ONEMAP_EMAIL=your@email.com
ONEMAP_PASSWORD=your-password

# Google Places (New) — 餐馆名称搜索
GOOGLE_PLACES_API_KEY=AIza...

# Ollama 代理 — LLM 推荐功能
OLLAMA_PROXY_URL=http://100.x.x.x:11434
OLLAMA_API_KEY=optional-bearer-token
```

### 3. 初始化数据库

在 Supabase SQL Editor 中按顺序执行 `supabase/migrations/` 下的所有 `.sql` 文件（`0001` → `0009`）。

执行 `0001_initial.sql` / `0007_messages.sql` 前，将其中的 `'YOUR-OWNER-UUID'` 替换为你的真实 user UUID。

### 4. 启动开发服务器

```bash
npm run dev
```

默认监听 `http://localhost:3001`。

## 项目结构

```
app/
  api/
    restaurants/        GET (带筛选) + POST / [id] PUT + DELETE
    tags/               GET + POST / [id] DELETE / reorder POST
    messages/           GET + POST / [id] PUT (回复) + DELETE
    geocode/            OneMap 地址搜索代理
    places/             Google Places (New) 文本搜索代理
    recommend/          LLM 流式推荐（SSE）
    admin/backfill-areas/  补齐历史 planning_area
  tags/                 标签管理页（拖拽排序、创建、删除）
  about/                关于页
  offline/              PWA 离线页
  auth/callback/        Google OAuth 回调
  manifest.ts           PWA manifest
  HomePage.tsx          客户端根组件（状态、筛选、视图切换、推荐聊天）

components/
  map/                  MapContainer、PinMarker、AddPinModal
  sidebar/              FilterPanel
  recommend/            RecommendChat（LLM 聊天面板）
  guestbook/            GuestbookPanel
  tags/                 TagInput
  ui/                   shadcn/ui 基础组件
  DisclaimerModal.tsx   首次访问免责声明
  RestaurantList.tsx    列表视图

lib/
  types.ts              核心类型
  constants.ts          地图常量、菜系配色、emoji
  filter.ts             EWKB 解析、tag 过滤、距离计算
  llm.ts                Ollama 客户端封装
  auth.ts               signIn / signOut
  utils.ts              cn、formatCostRange 等
  onemap.ts             OneMap 搜索 + planning area 点查
  supabase/             client / server 客户端
```

## 自己部署

这个项目是为单一 owner 设计的（只有你自己能增删改）。如果你也想搭一个自己的版本：

1. Fork 这个仓库
2. 在 Supabase 建项目，按顺序执行 `0001` → `0009` migrations
3. 在 Supabase 开启 Google OAuth，配置回调 URL
4. 申请 Google Places API (New) key、注册 OneMap 账号
5. 想用 LLM 推荐功能：本地跑 Ollama，拉 Qwen3 14B 模型，用 Tailscale 暴露给 Vercel
6. 在 Vercel 部署，填入环境变量

唯一需要改的业务逻辑：把 `NEXT_PUBLIC_OWNER_USER_ID` / `OWNER_USER_ID` 换成你自己的 Supabase user UUID。

---

提 issue 推荐餐馆、找 bug、或者赞助作者吃饭都行 :)

联系：shinomiyatsukinai@gmail.com
