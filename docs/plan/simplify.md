# FoodMap Simplify & Optimization Plan

全项目代码审查，覆盖 API routes、lib 层、组件层和 app 层。
共发现 29 个问题，划分为 9 个独立工作单元。

---

## 问题清单

### 高优先级（Bug / 生产安全）

| # | 问题 | 文件 | 说明 |
|---|------|------|------|
| 1 | 硬编码调试 fetch | `app/api/geocode/route.ts` | 每次地理编码请求都触发对 `127.0.0.1:7785` 的额外请求，生产环境静默失败 |
| 2 | `Number()` 无 isFinite 检查 | `app/api/restaurants/route.ts:25-26` | `Number("abc")` 返回 NaN，会传入数据库查询 |
| 3 | `parseFloat()` 无坐标验证 | `lib/onemap.ts:31-32` | OneMap API 返回无效坐标时会存入 NaN |
| 4 | 标签删除-插入无原子性 | `app/api/restaurants/[id]/route.ts:31-42` | 删除旧标签后插入失败会导致餐厅失去所有标签 |
| 5 | GuestbookPanel DELETE 未检查响应 | `components/guestbook/GuestbookPanel.tsx:74-77` | 删除失败仍从 UI 移除消息 |
| 6 | PinMarker handleDelete 无错误处理 | `components/map/PinMarker.tsx:43-47` | 删除失败仍调用 onRefresh() |
| 7 | TagInput createTag/deleteTag 未检查 res.ok | `components/tags/TagInput.tsx:82-111` | 服务端返回错误时 UI 状态不一致 |
| 8 | HomePage 无限 fetch 依赖链 | `app/HomePage.tsx:96,108-109` | filters 对象变化 → fetchRestaurants 重建 → useEffect 触发 → 循环 |

### 中优先级（代码质量 / DRY）

| # | 问题 | 文件 | 说明 |
|---|------|------|------|
| 9 | 四个相同的标签过滤块 | `app/api/restaurants/route.ts:68-98` | cuisine/dish/taste/scene 过滤逻辑完全相同，仅 type 字符串不同 |
| 10 | signIn/signOut 函数三处重复 | `AuthButton.tsx`, `GuestbookPanel.tsx`, `FilterPanel.tsx` | 相同实现出现三次 |
| 11 | CUISINE_COLORS 和 CUISINE_BG 两个平行 Map | `lib/constants.ts` | 相同菜系出现两次，应合并为单一结构 |
| 12 | EditPinModal 是无用包装组件 | `components/map/EditPinModal.tsx` | 完全透传所有 props 给 AddPinModal，无任何自有逻辑 |
| 13 | 标签 ID 合并逻辑重复 | `restaurants/route.ts:139-144`, `[id]/route.ts:32-37` | 相同的展开逻辑出现两次 |
| 14 | tags/route.ts 分开导入同一模块 | `app/api/tags/route.ts:2-3` | `createClient` 和 `requireOwner` 应合并为一行 |
| 15 | URL 参数构建重复 8 次 | `app/HomePage.tsx:76-96` | 每个 filter 字段各自一个 if 语句 |
| 16 | childrenByParent Map 每次渲染重建 | `components/sidebar/FilterPanel.tsx:63-69` | 缺 useMemo |
| 17 | cuisine 层级逻辑与 FilterPanel 重复 | `components/tags/TagInput.tsx:43-49` | 相同分组逻辑出现两次 |
| 18 | 两个可合并的 useEffect | `components/RestaurantList.tsx:84-85` | [restaurants] 和 [pageSize] 各触发 setPage(0) |

### 中优先级（性能）

| # | 问题 | 文件 | 说明 |
|---|------|------|------|
| 19 | computeGroupInfo 每次渲染执行 | `components/map/MapContainer.tsx:99` | 缺 useMemo |
| 20 | 四个 tag filter 每次渲染执行 | `components/map/PinMarker.tsx:25-28` | cuisineTags/dishTags/tasteTags/sceneTags 缺 useMemo |
| 21 | 标签分组每次渲染执行 | `components/sidebar/FilterPanel.tsx:60-72` | cuisineTopLevel/cuisineSub 等缺 useMemo |
| 22 | totalPages/pageItems 每次渲染计算 | `components/RestaurantList.tsx:87-88` | 缺 useMemo |
| 23 | computeIsDirty O(n²) 算法 | `app/tags/TagsManager.tsx:43-61` | 嵌套 find()，应改为 Map 比较降为 O(n) |

### 低优先级（风格 / 一致性）

| # | 问题 | 文件 | 说明 |
|---|------|------|------|
| 24 | 直接 DOM 样式操纵 | `RestaurantList.tsx:303-308`, `AddPinModal.tsx:233-235` | onMouseEnter 设置 style，应改用 CSS `:hover` |
| 25 | 硬编码颜色 | `TagsManager.tsx:279,638-639`, `HomePage.tsx:112` | `#c0392b`、`rgba(31,28,24,0.4)` 等未使用 CSS 变量 |
| 26 | DELETE 响应格式不一致 | `messages/[id]/route.ts:33` vs `restaurants/[id]/route.ts` | 前者返回 204，后者返回 JSON |
| 27 | page.tsx 的 force-dynamic 冗余 | `app/page.tsx:1` | 渲染纯 Client Component 时此配置无效 |
| 28 | isMobile 初始值错误 | `app/HomePage.tsx:45` | 初始 `true` 导致大屏幕首次加载侧边栏状态错误 |
| 29 | server.ts 空 catch 块 | `lib/supabase/server.ts:20` | Cookie 设置失败被静默吞掉，无任何日志 |

---

## 工作单元

### Unit 1 — 移除调试代码 + API 输入验证

**文件**: `app/api/geocode/route.ts`, `app/api/restaurants/route.ts`, `lib/onemap.ts`

- 删除 geocode 中硬编码的 `fetch('http://127.0.0.1:7785/...')` 调用（问题 #1）
- 为 `Number()` 转换添加 `isFinite()` 检查（问题 #2）
- 为 `parseFloat()` 坐标添加 `isFinite()` 验证（问题 #3）
- status filter 添加白名单验证，只允许 `'want' | 'visited'`

---

### Unit 2 — API 路由 DRY 修复

**文件**: `app/api/restaurants/route.ts`, `app/api/restaurants/[id]/route.ts`, `app/api/tags/route.ts`

- 提取 `filterByTagType(results, tagNames, type)` 函数，替代四个重复的过滤块（问题 #9）
- 提取 `flattenTagIds(body)` 函数，替代两处相同的标签合并展开逻辑（问题 #13）
- 合并 tags/route.ts 的两行分开 import 为一行（问题 #14）
- 统一 DELETE 响应格式为 `{ success: true }`（问题 #26）

---

### Unit 3 — 共享认证工具函数

**文件**: `lib/auth.ts`（新建）, `components/AuthButton.tsx`, `components/guestbook/GuestbookPanel.tsx`, `components/sidebar/FilterPanel.tsx`

```typescript
// lib/auth.ts
import { createClient } from '@/lib/supabase/client'

export async function signIn() {
  const supabase = createClient()
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${location.origin}/auth/callback` },
  })
}

export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
}
```

三个组件删除内联实现，改为从 `@/lib/auth` 导入（问题 #10）

---

### Unit 4 — 常量结构简化

**文件**: `lib/constants.ts` + 所有引用方

```typescript
// 现在
export const CUISINE_COLORS: Record<string, string> = { '粤菜': '#a03020', ... }
export const CUISINE_BG: Record<string, string> = { '粤菜': '#faeae5', ... }

// 改为
export const CUISINE_STYLES: Record<string, { color: string; bg: string }> = {
  '粤菜': { color: '#a03020', bg: '#faeae5' },
  ...
}
```

更新所有使用 `CUISINE_COLORS[x]` 和 `CUISINE_BG[x]` 的地方（问题 #11）

---

### Unit 5 — useMemo/useCallback 补全

**文件**: `components/map/MapContainer.tsx`, `components/map/PinMarker.tsx`, `components/sidebar/FilterPanel.tsx`, `components/RestaurantList.tsx`

```typescript
// MapContainer.tsx
const groupInfo = useMemo(
  () => computeGroupInfo(restaurants, spiderfiedKey),
  [restaurants, spiderfiedKey]
) // 问题 #19

// PinMarker.tsx
const cuisineTags = useMemo(() => restaurant.tags.filter(t => t.type === 'cuisine'), [restaurant.tags])
// 同理 dish/taste/scene // 问题 #20

// FilterPanel.tsx
const cuisineTopLevel = useMemo(() => allTags.filter(t => t.type === 'cuisine' && !t.parent_id), [allTags])
const childrenByParent = useMemo(() => { ... }, [cuisineSub]) // 问题 #16, #21

// RestaurantList.tsx
const totalPages = useMemo(() => Math.max(1, Math.ceil(restaurants.length / pageSize)), [restaurants.length, pageSize])
const pageItems = useMemo(() => restaurants.slice(page * pageSize, (page + 1) * pageSize), [restaurants, page, pageSize])
useEffect(() => { setPage(0) }, [restaurants, pageSize]) // 合并两个 effect // 问题 #22, #18
```

---

### Unit 6 — 组件 fetch 错误处理

**文件**: `components/map/PinMarker.tsx`, `components/map/AddPinModal.tsx`, `components/guestbook/GuestbookPanel.tsx`, `components/tags/TagInput.tsx`

- 所有 fetch 调用添加 `res.ok` 检查（问题 #5, #6, #7）
- GuestbookPanel fetchMessages 包 try-catch，保证 loading 在失败时也重置
- DELETE/PATCH 操作仅在 `res.ok` 时更新 UI state
- PinMarker handleDelete：失败时显示提示，不调用 onRefresh()

---

### Unit 7 — HomePage 状态与数据获取修复

**文件**: `app/HomePage.tsx`, `app/page.tsx`

```typescript
// 提取 URL 参数构建函数（问题 #15）
function buildFilterParams(filters: FilterPayload): URLSearchParams {
  const params = new URLSearchParams()
  const arrayKeys = ['cuisine_tags', 'dish_tags', 'taste_tags', 'scene_tags', 'status', 'ratings'] as const
  for (const key of arrayKeys) {
    const val = filters[key] as string[]
    if (val.length > 0) params.set(key, val.join(','))
  }
  return params
}

// 修复依赖链（问题 #8）：直接依赖 filters 原始值，不依赖 fetchRestaurants 函数

// 修复 isMobile 初始值（问题 #28）
const [isMobile, setIsMobile] = useState(() =>
  typeof window !== 'undefined' ? window.innerWidth < 768 : true
)
```

删除 `page.tsx` 中的 `export const dynamic = 'force-dynamic'`（问题 #27）

---

### Unit 8 — CSS 与样式规范化

**文件**: `app/globals.css`, `components/RestaurantList.tsx`, `components/map/AddPinModal.tsx`, `components/tags/TagsManager.tsx`, `app/HomePage.tsx`

在 `globals.css` 添加：
```css
--fm-error: #c0392b;
--fm-overlay: rgba(31, 28, 24, 0.4);
```

- 替换 TagsManager 中的 `#c0392b` 为 `var(--fm-error)`（问题 #25）
- 替换 HomePage 中的硬编码 rgba 为 `var(--fm-overlay)`
- 将 RestaurantList/AddPinModal 中的 onMouseEnter DOM 操纵改为 CSS `:hover`（问题 #24）

---

### Unit 9 — 小型结构清理

**文件**: `components/map/EditPinModal.tsx`, `components/map/MapContainer.tsx`, `lib/supabase/server.ts`, `app/tags/TagsManager.tsx`

- 删除 `EditPinModal.tsx`，MapContainer 直接用 `AddPinModal`（问题 #12）
- `server.ts` 空 catch 改为 `catch (e) { console.warn('Cookie set failed:', e) }`（问题 #29）
- `TagsManager.computeIsDirty` 改用 Map，O(n²) → O(n)（问题 #23）：
  ```typescript
  function computeIsDirty(current: Tag[], saved: Tag[]): boolean {
    const savedMap = new Map(saved.map(t => [t.id, t]))
    if (current.some(t => t.id.startsWith('tmp-'))) return true
    if (current.length !== saved.length) return true
    return current.some(t => !savedMap.has(t.id) || savedMap.get(t.id)!.name !== t.name)
  }
  ```

---

## 验证方式

```bash
npm run build          # 类型检查 + 构建验证

npm run dev            # 启动开发服务器后手动测试：
                       # - 首页加载，地图显示 pins
                       # - 登录后添加新餐厅 pin
                       # - 编辑已有餐厅（AddPinModal 编辑模式）
                       # - 删除餐厅
                       # - 过滤器：菜系（含子菜系）、菜品、口味、场景
                       # - 留言本：发送 / owner 回复 / 删除
                       # - /tags 页面：拖拽排序、新建、删除标签
```
