# 食迹 — Project Guide for Claude

## What This Is

A personal Singapore food map. Single-owner (Google OAuth). Public read-only. Owner can add/edit/delete restaurant pins directly on the map. Any signed-in user can leave guestbook messages, submit pin recommendations, and use the LLM recommend chat (with thumbs-down feedback).

## Tech Stack

- **Next.js 16** (App Router) + TypeScript
- **MapLibre GL** + react-map-gl (map rendering)
- **OneMap API** — Singapore address lookup (planning area point-in-polygon, owner credentials), proxied via `/api/geocode`
- **Google Places API (New)** — restaurant name search in AddPinModal / PinRequestModal, proxied via `/api/places`
- **Supabase** — PostgreSQL + PostGIS + Auth + RLS
- **Google OAuth** — single owner edits restaurants; any authenticated user can post guestbook / submit pin requests / give LLM feedback
- **Ollama (Qwen3 Agent)** — natural-language recommend chat + dashboard AI summary, called over an authenticated proxy
- **Tailwind CSS v4** + shadcn/ui
- **PWA** — manifest + service worker (workbox), offline fallback
- **Vitest** — unit tests for `lib/filter.ts` (LLM eval harness lives in `scripts/eval-recommend.mts`)

## Project Structure

```
app/
  page.tsx                  server component, reads auth user, renders HomePage
  HomePage.tsx              client root: state, filter, sidebar, map/list/guestbook toggle, recommend chat, pin-request modal, pending-requests badge
  layout.tsx                fonts: Geist Sans, Geist Mono, Instrument Serif
  manifest.ts               PWA manifest (name, icons, theme)
  about/page.tsx            about page
  offline/page.tsx          PWA offline fallback page
  dashboard/
    page.tsx                owner-only dashboard (server gate via requireOwner)
    DashboardClient.tsx     stat cards, distributions, AI taste summary, inline admin (pin requests + LLM feedback)
  tags/
    page.tsx                tags management page (owner only)
    TagsManager.tsx         drag-and-drop tag sort, create/delete tags
  api/
    restaurants/route.ts            GET (filtered list) + POST (create, auto-fills planning_area)
    restaurants/[id]/route.ts       PUT (update) + DELETE
    tags/route.ts                   GET all tags + POST (create)
    tags/[id]/route.ts              DELETE
    tags/reorder/route.ts           POST batch sort_order update
    messages/route.ts               GET + POST guestbook messages
    messages/[id]/route.ts          PUT (owner reply) + DELETE (owner only)
    pin-requests/route.ts           GET (owner, pending only) + POST (any authed user submits a recommendation)
    pin-requests/[id]/route.ts      DELETE (owner rejects)
    pin-requests/[id]/approve/route.ts  POST (owner: promote request → restaurants row + tags, then delete request)
    llm-feedback/route.ts           POST (authed user, thumbs-down on an assistant msg) + GET/DELETE (owner)
    llm-health/route.ts             GET — pings the Ollama proxy / model availability
    geocode/route.ts                OneMap address search proxy
    places/route.ts                 Google Places (New) text search proxy
    recommend/route.ts              LLM streaming chat (SSE): intent → search → recommendation
    dashboard/stats/route.ts        owner-only aggregate stats (counts, cost avg, rating/cuisine/area/taste/scene breakdowns, recent)
    dashboard/ai-summary/route.ts   owner-only SSE: streams an Ollama 150-200 字 taste analysis built from dashboard stats
    admin/backfill-areas/route.ts   owner-only: backfill missing planning_area for legacy rows
  auth/callback/route.ts            Supabase OAuth callback

components/
  map/
    MapContainer.tsx          map, pins, click-to-add, add/edit mode; spiderfy overlapping pins
    PinMarker.tsx             custom SVG marker + popup
    AddPinModal.tsx           shared modal for add and edit (place-search lives in the address field); exports getRatingStyle
  sidebar/
    FilterPanel.tsx           status, cuisine (expandable sub-cuisine), dish, taste, scene, cost, rating, area
  recommend/
    RecommendChat.tsx         floating LLM chat panel (SSE consumer); per-message thumbs-down feedback
    FeedbackPanel.tsx         standalone owner feedback inbox (also embedded inline in dashboard)
  pin-requests/
    PinRequestModal.tsx       non-owner submission form (Google Places search → name/address/lat/lng, cuisine + scene tags, notes)
    PinRequestsPanel.tsx      owner modal: list pending requests, approve / reject (dashboard has an inline copy too)
  tags/
    TagInput.tsx              autocomplete tag input with create-on-type
  guestbook/
    GuestbookPanel.tsx        guestbook: list messages, post, owner reply/delete
  ui/                         shadcn/ui primitives (button, dialog, input, etc.)
  AuthButton.tsx              sign-in / sign-out button
  DisclaimerModal.tsx         first-visit disclaimer, dismissal stored in localStorage
  OwnerDashboardLink.tsx      floating dashboard link for owner (shown on non-dashboard pages + mobile homepage; desktop homepage uses the header link)
  RestaurantList.tsx          list view of filtered restaurants

lib/
  types.ts                  Tag, Restaurant, RestaurantFormData, FilterPayload, RestaurantStatus, RestaurantRating, RATING_ORDER, PinRequest, OneMapResult
  constants.ts              SINGAPORE_CENTER, preset tags (with parent hierarchy), cuisine colors/emoji
  filter.ts                 parseEWKBPoint, filterByTagType, partitionKnownTagNames, expandCuisineTagNames, haversineKm
  filter.test.ts            vitest unit tests for the above
  locationResolve.ts        resolveLocation: planning-area exact match → region keyword (中部/east/…) → OneMap geocode + radius. Includes CN→EN translation + region→planning-area maps
  llm.ts                    AVAILABLE_MODELS list, DEFAULT_MODEL ('qwen3-agent:latest'), resolveModel()
  auth.ts                   signIn / signOut helpers (Google OAuth)
  utils.ts                  cn, getTagsByType, formatCostRange
  onemap.ts                 OneMap address search + planning-area point-in-polygon
  supabase/client.ts        browser Supabase client
  supabase/server.ts        createClient (cookie-bound), createAdminClient (service role), requireOwner()

scripts/
  eval-recommend.mts        recall@8 harness for the recommend pipeline (reads tests/recommend-golden.json, needs a session cookie)
  generate-icons.mjs / gen-icons.mjs  PWA icon generation

tests/
  recommend-golden.json     golden queries + expected restaurant ids for the eval harness

supabase/migrations/
  0001_initial.sql          tags, restaurants (PostGIS), restaurant_tags, RLS policies
  0002_expand_tag_types.sql add 'taste', 'scene' to tag type constraint
  0003_signature_dishes.sql add signature_dishes TEXT[] column
  0004_status.sql           add status ('want'|'visited') to restaurants
  0005_tag_parent_seed.sql  add parent_id to tags; seed all preset tags with hierarchy
  0006_tag_sort_order.sql   add sort_order to tags
  0007_messages.sql         guestbook messages table + RLS
  0008_rating.sql           add rating column (夯/顶级/人上人/NPC/拉完了/未评分)
  0009_planning_area.sql    add planning_area TEXT column (auto-filled on insert)
  0010_pin_requests.sql     pin_requests table + RLS (authed users insert; owner SELECT/DELETE via service-role client)
  0011_llm_feedback.sql     llm_feedback table + RLS (authed users insert; owner SELECT/DELETE)
```

## Key Data Model

```
tags (id, name, type: 'cuisine'|'dish'|'taste'|'scene', parent_id UUID, sort_order INT, created_at)
restaurants (id, name, address, postal_code, location GEOGRAPHY(POINT,4326),
             cost_min, cost_max, notes, signature_dishes TEXT[],
             status TEXT ('want'|'visited'),
             rating TEXT ('夯'|'顶级'|'人上人'|'NPC'|'拉完了'|'未评分'),
             planning_area TEXT,
             created_at, updated_at)
restaurant_tags (restaurant_id, tag_id)  — junction
messages (id, user_id, author_name, author_avatar, content, reply, replied_at, created_at)
pin_requests (id, user_id, author_name, author_avatar, name, address, postal_code,
              lng, lat, cuisine_tag_ids UUID[], scene_tag_ids UUID[], notes,
              status ('pending'|'approved'|'rejected'), created_at)
llm_feedback (id, user_id, msg_content, feedback_text, created_at)
```

Geography column `location` is stored as PostGIS WKT `POINT(lng lat)`. The GET handler parses the raw EWKB hex back to `[lng, lat]` with `parseEWKBPoint` (in `lib/filter.ts`).

`planning_area` is computed server-side on insert via `getPlanningArea(lat, lng)` — fetches all 55 OneMap planning-area polygons (cached 24h) and runs a local point-in-polygon check. The paid OneMap endpoint is avoided.

Tag `parent_id` supports sub-cuisine hierarchy (e.g. 粤菜/川菜 under 中餐). Top-level cuisine tags have `parent_id = NULL`.

## Auth & Ownership

- `NEXT_PUBLIC_OWNER_USER_ID` env var holds the owner's Supabase user UUID (client-side gating in `HomePage.tsx`, `OwnerDashboardLink`, etc.).
- `OWNER_USER_ID` is the server-side equivalent, checked by `requireOwner()` in `lib/supabase/server.ts`.
- RLS policies in Supabase are a second layer:
  - `restaurants` / `tags`: public SELECT, owner-only INSERT/UPDATE/DELETE.
  - `messages` / `pin_requests` / `llm_feedback`: authed users can INSERT their own row; owner reads/writes via service-role client (bypassing RLS) in API routes.

## Tag System

Tags are reused across restaurants. Four types: `cuisine`, `dish`, `taste`, `scene`.

All preset tags are seeded into the DB (migration `0005`) with `parent_id` hierarchy for cuisine sub-tags. Tags always come from DB. `sort_order` controls display order and is editable via drag-and-drop in `/tags` (persisted via `POST /api/tags/reorder`).

## Filter Pipeline

1. `FilterPanel` builds a `FilterPayload` (cuisine, dish, taste, scene, cost, status, ratings, areas).
2. `HomePage` serializes it into query params → `GET /api/restaurants`.
3. The API filters cost / status / rating in SQL; tag filters run post-query in JS (Supabase JS doesn't support junction-based filtering neatly).
4. `planning_area` filtering happens client-side in `HomePage` against the already-loaded list — this lets the area checkboxes update instantly without a refetch.

Cuisine filter supports hierarchy: selecting a parent tag includes all its sub-tags (`expandCuisineTagNames` in `lib/filter.ts`).

## Recommend (LLM)

`POST /api/recommend` is auth-gated and streams Server-Sent Events with three stages:

1. **understanding (Stage A)** — calls Ollama native `/api/chat` with `think: false` + the `search_restaurants` tool. Tool args extract `cuisine_tags` / `dish_tags` / `taste_tags` / `scene_tags`, `max_cost` / `min_cost`, `status`, `ratings`, `location_query`, `radius_km`. The system prompt instructs the model to translate any Chinese/abbreviated location to standard English (e.g. `乌节路`→`Orchard Road`, `tjpg`→`Tanjong Pagar`) so the downstream resolver can geocode it. Hallucinated tag names are dropped by `partitionKnownTagNames` before search.
2. **searching (Stage B)** — `resolveLocation(location_query, availableAreas)` decides among:
   - exact planning-area name (case-insensitive, only those with data) → SQL `eq('planning_area', …)`,
   - region keyword (中部/east/…) → SQL `in('planning_area', […])`,
   - OneMap geocode → point + `radius_km` (default 2) → JS `haversineKm` filter.
   Cost/status/rating/area run in SQL; tag + distance filtering runs in JS. Sends `{ type: 'meta', restaurant_ids, filter, location }` to the client so the map/list highlight syncs.
3. **writing (Stage C)** — streams the recommendation text via Ollama's native `/api/chat`. No top-N cap and no `num_predict` ceiling (was hurting longer recommendations).

Note: native `/api/chat` is used in both Stage A and Stage C because the OpenAI-compat endpoint drops `think: false`, leaving Qwen in reasoning mode and ballooning latency.

Stage timings (`stage_a_ms`, `resolve_ms`, `stage_b_ms`, `stage_c_ttft_ms`, `stage_c_total_ms`, `total_ms`) are emitted to the SSE so the eval harness can measure them.

`RecommendChat` consumes the SSE and renders staged status text + streamed assistant message. Each assistant turn has a thumbs-down button that posts to `/api/llm-feedback`. The chat panel is opened from the AI 推荐 button in the header.

## Pin Requests (Community Recommendations)

- Any signed-in user (not the owner) sees a "推荐餐馆" button in the header. `PinRequestModal` collects name/address (Google Places search → auto-fills lat/lng/postal_code), cuisine + scene tags, and required notes.
- Owner sees a "待审 (N)" button that opens `PinRequestsPanel`. The dashboard also embeds the same list inline.
- Approving (`POST /api/pin-requests/[id]/approve`) inserts a `restaurants` row (`status='want'`, `rating='未评分'`, `planning_area` resolved via OneMap), copies the chosen tag ids into `restaurant_tags`, and deletes the request.

## Dashboard

`/dashboard` (server-gated by `requireOwner`) renders `DashboardClient`:

- 4 stat cards (total / 已吃 / 想去 / 人均消费)
- a status filter (全部 / 已吃 / 想去) — refetches `/api/dashboard/stats?filter=…`
- 评分 / 地区 / 菜系 / 口味 & 场合 distributions with horizontal bars
- AI 口味总结 — calls `/api/dashboard/ai-summary` (SSE), streaming a 150-200 字 Chinese taste analysis from Ollama
- Inline admin panels for 待审核推荐 + AI 回答反馈 (same actions as the standalone modals)

`OwnerDashboardLink` shows a floating link to `/dashboard` on every page except the dashboard itself; on the desktop homepage the header already has the link, so the floating button is hidden there.

## Environment Variables

See `.env.local.example`. Required:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_OWNER_USER_ID
OWNER_USER_ID

# OneMap (planning area lookup, free account)
ONEMAP_EMAIL
ONEMAP_PASSWORD

# Google Places (New) — restaurant name search
GOOGLE_PLACES_API_KEY

# Ollama proxy — LLM recommend chat + dashboard AI summary
OLLAMA_PROXY_URL
OLLAMA_API_KEY
```

`lib/llm.ts` currently exposes a single model id `qwen3-agent:latest`. Adding a new model = appending to `AVAILABLE_MODELS`; `resolveModel()` falls back to `DEFAULT_MODEL` for unknown ids.

## CSS Design System

Custom CSS variables defined in `app/globals.css` under `:root`:
- `--fm-paper`, `--fm-cream`, `--fm-ink`, `--fm-ink-2/3/4`, `--fm-line/line-2`
- `--fm-orange`, `--fm-orange-dark`, `--fm-green`, `--fm-muted`

Utility classes: `fm-chip`, `fm-chip-taste`, `fm-chip-scene`, `fm-filter-label`, `fm-filter-label-count`.

Fonts: `--font-geist-sans` (body), `--font-geist-mono` (monospace, also used for stat numerals), `--font-instrument-serif` (logo, big stat values).

## Dev Notes

- `MapContainer` is imported with `dynamic(..., { ssr: false })` — MapLibre is browser-only.
- `maplibre-gl` is in `transpilePackages` in `next.config.ts` — do not remove.
- PWA: service worker (`public/sw.js`, workbox) + offline page at `/offline`. Icons live in `public/icons/`.
- Dev/start port is `3001` (set in `package.json`).
- `--no-pager` goes on `git`, not the subcommand: `git --no-pager diff`, not `git diff --no-pager`.
- Never edit on `main`. Work on `dev` or a `feat/*`/`fix/*` branch.
- Commands: `npm run dev` (3001), `npm run build`, `npm run lint`, `npm test` / `npm run test:run` (vitest), `npm run eval:recommend` (LLM eval, needs dev server + session cookie).
- The mobile sidebar open/closed state is persisted to `localStorage` (`sidebar-open`).
- `getRatingStyle` is exported from `components/map/AddPinModal.tsx` and reused on the dashboard — keep the colour mapping consistent there.
