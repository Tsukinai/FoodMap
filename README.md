# FoodMap

新加坡美食地图。个人用途，记录探索过的餐馆。地图 + 列表双视图，支持菜系/口味/区域多维筛选，以及自然语言 AI 搜索。

## 功能

- 交互式地图，点击地图添加餐馆 Pin
- 餐馆信息：名称、地址（OneMap 新加坡邮编搜索）、人均消费、招牌菜、备注
- 标签系统：菜系、菜品种类、口味、场合，标签跨餐馆复用
- 多维筛选：区域（五大区域）、菜系、种类、口味、场合、人均消费
- AI 搜索：自然语言描述 → 自动转换为筛选参数（NVIDIA NIM）
- 地图 / 列表切换视图
- Google OAuth 登录，只有本人可编辑，公开只读

## Tech Stack


| 层         | 技术                                    |
| --------- | ------------------------------------- |
| Framework | Next.js 16 (App Router) + TypeScript  |
| Map       | MapLibre GL + react-map-gl            |
| 地址搜索      | OneMap API（新加坡，免费无需 key）              |
| 数据库       | Supabase (PostgreSQL + PostGIS + RLS) |
| 认证        | Supabase Auth + Google OAuth          |
| LLM       | NVIDIA NIM — minimax/MiniMax-Text-01  |
| UI        | Tailwind CSS v4 + shadcn/ui           |
| 部署        | Vercel                                |


## 本地运行

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.local.example` 为 `.env.local`，填写以下内容：

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# 首次登录后从 Supabase Dashboard > Authentication > Users 获取
NEXT_PUBLIC_OWNER_USER_ID=your-supabase-user-uuid
OWNER_USER_ID=your-supabase-user-uuid

# NVIDIA NIM API Key: https://build.nvidia.com
NVIDIA_API_KEY=nvapi-...
```

### 3. 初始化数据库

在 Supabase SQL Editor 中按顺序执行：

```
supabase/migrations/0001_initial.sql
supabase/migrations/0002_expand_tag_types.sql
supabase/migrations/0003_signature_dishes.sql
```

然后把 `0001_initial.sql` 中的 `'YOUR-OWNER-UUID'` 替换为你的真实 user UUID。

### 4. 启动开发服务器

```bash
npm run dev
```

## 项目结构

```
app/
  api/
    restaurants/        GET (带筛选) + POST / [id] PUT + DELETE
    tags/               GET + POST / [id] DELETE
    geocode/            OneMap 代理
    llm-filter/         NIM 自然语言 → FilterPayload
  auth/callback/        Google OAuth 回调
  HomePage.tsx          客户端根组件（状态、筛选、视图切换）

components/
  map/                  MapContainer、PinMarker、AddPinModal
  sidebar/              FilterPanel、SmartSearchBar
  tags/                 TagInput（自动补全 + 即时创建）
  RestaurantList.tsx    列表视图

lib/
  types.ts              核心类型
  constants.ts          地图常量、预设标签、菜系配色
  supabase/             client / server 客户端
  onemap.ts             OneMap 搜索封装
```

## TODO

### 功能

- 移动端适配 — 目前布局为桌面优先，小屏下侧边栏和地图交互需要重新设计
- 点击地图 Pin 显示餐馆 popup，支持从 popup 直接跳转编辑
- 餐馆照片上传（Supabase Storage）
- 添加about页

### 技术债

- tag filter 目前在 JS 端做后过滤，数据量大时效率低 — 改为 PostgREST `?junction.tag_id=in.(...)` 查询
- `FilterPayload` 在客户端序列化成 query string 传给 API，考虑改为 POST body 减少 URL 长度限制风险
- LLM filter 的 `scene_tags` 字段尚未接入 NIM schema（当前 schema 只有 `cuisine/dish/taste`）
- 补充 E2E 测试（Playwright），覆盖添加 Pin → 筛选 → 编辑 → 删除完整流程
- 搭建 Supabase 本地开发环境（`supabase start`），替代直连远端 dev 项目

### 体验优化

- SmartSearchBar 加 loading 状态（目前 NIM 返回前无反馈）
- Filter 面板搜索结果数量实时显示（目前在结果返回后才更新）
- Pin 颜色按菜系着色（constants.ts 中已有 CUISINE_COLORS，尚未接入 PinMarker）
- 侧边栏折叠状态持久化到 localStorage
- 深色模式支持

