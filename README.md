# 食迹

> 在新加坡吃了很多顿饭，但有一个很真实的问题——我经常吃完就忘，名字忘，店也忘，只剩下"好像很好吃"这种模糊的幸福感。
>
> 于是就做了这个东西。一半是备忘录，一半是吃货的数据库。

新加坡个人美食地图。记录吃过的、想吃的，按菜系 / 口味 / 场合随时筛出来。

## 功能

- 交互式地图，点击添加餐馆 Pin；重叠 Pin 自动展开（spiderfy）
- 餐馆信息：名称、地址（OneMap 邮编搜索）、人均消费、招牌菜、状态（想去 / 已去）、备注
- 标签系统：菜系（含子菜系层级）、菜品、口味、场合，跨餐馆复用，支持拖拽排序
- 多维筛选：菜系（可展开子菜系）、种类、口味、场合、人均消费
- 地图 / 列表双视图，移动端响应式
- 留言板：任意 Google 账号登录可留言，本人可回复 / 删除
- Google OAuth 登录，只有本人可编辑餐馆，公开只读

## Tech Stack

| 层         | 技术                                    |
| --------- | ------------------------------------- |
| Framework | Next.js 16 (App Router) + TypeScript  |
| Map       | MapLibre GL + react-map-gl            |
| 地址搜索      | OneMap API（新加坡，免费无需 key）              |
| 数据库       | Supabase (PostgreSQL + PostGIS + RLS) |
| 认证        | Supabase Auth + Google OAuth          |
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
```

### 3. 初始化数据库

在 Supabase SQL Editor 中按顺序执行 `supabase/migrations/` 下的所有 `.sql` 文件（`0001` → `0007`）。

执行 `0001_initial.sql` 前，将其中的 `'YOUR-OWNER-UUID'` 替换为你的真实 user UUID。

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
    messages/           GET + POST / [id] PUT (回复) + DELETE
    geocode/            OneMap 代理
  tags/                 标签管理页（拖拽排序、创建、删除）
  about/                关于页
  auth/callback/        Google OAuth 回调
  HomePage.tsx          客户端根组件（状态、筛选、视图切换）

components/
  map/                  MapContainer、PinMarker、AddPinModal
  sidebar/              FilterPanel（含子菜系展开）
  guestbook/            GuestbookPanel（留言 + 回复）
  tags/                 TagInput（自动补全 + 即时创建）
  DisclaimerModal.tsx   首次访问免责声明
  RestaurantList.tsx    列表视图

lib/
  types.ts              核心类型
  constants.ts          地图常量、菜系配色
  supabase/             client / server 客户端
  onemap.ts             OneMap 搜索封装
```

## 自己部署

这个项目是为单一 owner 设计的（只有你自己能增删改）。如果你也想搭一个自己的版本：

1. Fork 这个仓库
2. 在 Supabase 建项目，执行上面的 migrations
3. 在 Supabase 开启 Google OAuth，配置回调 URL
4. 在 Vercel 部署，填入环境变量

唯一需要改的业务逻辑：把 `NEXT_PUBLIC_OWNER_USER_ID` / `OWNER_USER_ID` 换成你自己的 Supabase user UUID。

---

提 issue 推荐餐馆、找 bug、或者赞助作者吃饭都行 :)

联系：shinomiyatsukinai@gmail.com
