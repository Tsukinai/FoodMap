# 食迹 — Project Guide for Claude

## What This Is

A personal Singapore food map. Single-owner (Google OAuth). Public read-only. Owner can add/edit/delete restaurant pins directly on the map. Includes an LLM-powered natural-language recommendation chat.

## Tech Stack

- **Next.js 16** (App Router) + TypeScript
- **MapLibre GL** + react-map-gl (map rendering)
- **OneMap API** — Singapore address lookup (planning area point-in-polygon, owner credentials), proxied via `/api/geocode`
- **Google Places API (New)** — restaurant name search in AddPinModal, proxied via `/api/places`
- **Supabase** — PostgreSQL + PostGIS + Auth + RLS
- **Google OAuth** — single user login; any authenticated user can post to guestbook, owner can reply/delete
- **Ollama (Qwen3 14B Q4_K_M)** — natural-language recommend chat, called over an authenticated proxy
- **Tailwind CSS v4** + shadcn/ui
- **PWA** — manifest + service worker (workbox), offline fallback

## Project Structure

```
app/
  page.tsx                  server component, reads auth user, renders HomePage
  HomePage.tsx              client root: state, filter, sidebar, map/list/guestbook toggle, recommend chat
  layout.tsx                fonts: Geist Sans, Geist Mono, Instrument Serif
  manifest.ts               PWA manifest (name, icons, theme)
  about/page.tsx            about page
  offline/page.tsx          PWA offline fallback page
  tags/
    page.tsx                tags management page (owner only)
    TagsManager.tsx         drag-and-drop tag sort, create/delete tags
  api/
    restaurants/route.ts          GET (filtered list) + POST (create, auto-fills planning_area)
    restaurants/[id]/route.ts     PUT (update) + DELETE
    tags/route.ts                 GET all tags + POST (create)
    tags/[id]/route.ts            DELETE
    tags/reorder/route.ts         POST batch sort_order update
    messages/route.ts             GET + POST guestbook messages
    messages/[id]/route.ts        PUT (owner reply) + DELETE (owner only)
    geocode/route.ts              OneMap address search proxy
    places/route.ts               Google Places (New) text search proxy
    recommend/route.ts            LLM streaming chat (SSE): intent → search → recommendation
    admin/backfill-areas/route.ts owner-only: backfill missing planning_area for legacy rows
  auth/callback/route.ts          Supabase OAuth callback

components/
  map/
    MapContainer.tsx        map, pins, click-to-add, add/edit mode; spiderfy overlapping pins
    PinMarker.tsx           custom SVG marker + popup
    AddPinModal.tsx         shared modal for add and edit (place-search lives in the address field)
  sidebar/
    FilterPanel.tsx         status, cuisine (expandable sub-cuisine), dish, taste, scene, cost, rating, area
  recommend/
    RecommendChat.tsx       floating LLM chat panel (SSE consumer)
  tags/
    TagInput.tsx            autocomplete tag input with create-on-type
  guestbook/
    GuestbookPanel.tsx      guestbook: list messages, post, owner reply/delete
  ui/                       shadcn/ui primitives (button, dialog, input, etc.)
  AuthButton.tsx            sign-in / sign-out button
  DisclaimerModal.tsx       first-visit disclaimer, dismissal stored in localStorage
  RestaurantList.tsx        list view of filtered restaurants

lib/
  types.ts                  Tag, Restaurant, RestaurantFormData, FilterPayload, RestaurantStatus, RestaurantRating, OneMapResult
  constants.ts              SINGAPORE_CENTER, preset tags (with parent hierarchy), cuisine colors/emoji
  filter.ts                 parseEWKBPoint, filterByTagType, haversineKm
  llm.ts                    OpenAI-compat client pointed at Ollama proxy + LLM_MODEL
  auth.ts                   signIn / signOut helpers (Google OAuth)
  utils.ts                  cn, getTagsByType, formatCostRange
  onemap.ts                 OneMap address search + planning-area point-in-polygon
  supabase/client.ts        browser Supabase client
  supabase/server.ts        server Supabase client + requireOwner()

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
```

Geography column `location` is stored as PostGIS WKT `POINT(lng lat)`. The GET handler parses the raw EWKB hex back to `[lng, lat]` with `parseEWKBPoint` (now in `lib/filter.ts`).

`planning_area` is computed server-side on insert via `getPlanningArea(lat, lng)` — fetches all 55 OneMap planning-area polygons (cached 24h) and runs a local point-in-polygon check. The paid OneMap endpoint is avoided.

Tag `parent_id` supports sub-cuisine hierarchy (e.g. 粤菜/川菜 under 中餐). Top-level cuisine tags have `parent_id = NULL`.

## Auth & Ownership

- `NEXT_PUBLIC_OWNER_USER_ID` env var holds the owner's Supabase user UUID (client-side gating in `HomePage.tsx`).
- `OWNER_USER_ID` is the server-side equivalent, checked by `requireOwner()` in `lib/supabase/server.ts`.
- RLS policies in Supabase are a second layer: public SELECT, owner-only INSERT/UPDATE/DELETE.

## Tag System

Tags are reused across restaurants. Four types: `cuisine`, `dish`, `taste`, `scene`.

All preset tags are seeded into the DB (migration `0005`) with `parent_id` hierarchy for cuisine sub-tags. Tags always come from DB. `sort_order` controls display order and is editable via drag-and-drop in `/tags` (persisted via `POST /api/tags/reorder`).

## Filter Pipeline

1. `FilterPanel` builds a `FilterPayload` (cuisine, dish, taste, scene, cost, status, ratings, areas).
2. `HomePage` serializes it into query params → `GET /api/restaurants`.
3. The API filters cost / status / rating / planning_area in SQL; tag filters run post-query in JS (Supabase JS doesn't support junction-based filtering neatly).

Cuisine filter supports hierarchy: selecting a parent tag includes all its sub-tags.

## Recommend (LLM)

`POST /api/recommend` is auth-gated and streams Server-Sent Events with three stages:

1. **understanding** — calls Ollama chat with `search_restaurants` tool. Tool args extract cuisine/dish/taste/scene tags, cost range, status, ratings, `areas` (planning area names) and/or `near_location` + `radius_km`. The system prompt teaches the model the available tag list and the set of planning areas with actual data, plus a 中部/北部/东部… → planning area mapping.
2. **searching** — runs the Supabase query (cost/status/area in SQL, tags + distance in JS). For `near_location`, geocodes via OneMap then filters by `haversineKm`. Sends `{ type: 'meta', restaurant_ids, filter }` to the client so the map/list highlight syncs.
3. **writing** — streams the recommendation text via Ollama's native `/api/chat` (the OpenAI-compat endpoint drops the `think: false` flag, which leaves Qwen reasoning mode on).

`RecommendChat` consumes the SSE and renders staged status text + streamed assistant message. The chat panel is opened from a floating button in `HomePage`.

## Environment Variables

See `.env.local.example`. Required:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_OWNER_USER_ID
OWNER_USER_ID

# OneMap (planning area lookup)
ONEMAP_EMAIL
ONEMAP_PASSWORD

# Google Places (New) — restaurant name search
GOOGLE_PLACES_API_KEY

# Ollama proxy — LLM recommend
OLLAMA_PROXY_URL
OLLAMA_API_KEY
```

## CSS Design System

Custom CSS variables defined in `app/globals.css` under `:root`:
- `--fm-paper`, `--fm-cream`, `--fm-ink`, `--fm-ink-2/3/4`, `--fm-line/line-2`
- `--fm-orange`, `--fm-orange-dark`, `--fm-green`, `--fm-muted`

Utility classes: `fm-chip`, `fm-chip-taste`, `fm-chip-scene`, `fm-filter-label`, `fm-filter-label-count`.

Fonts: `--font-geist-sans` (body), `--font-geist-mono` (monospace), `--font-instrument-serif` (logo).

## Dev Notes

- `MapContainer` is imported with `dynamic(..., { ssr: false })` — MapLibre is browser-only.
- `maplibre-gl` is in `transpilePackages` in `next.config.ts` — do not remove.
- PWA: service worker (`public/sw.js`, workbox) + offline page at `/offline`. Icons live in `public/icons/`.
- Dev/start port is `3001` (set in `package.json`).
- `--no-pager` goes on `git`, not the subcommand: `git --no-pager diff`, not `git diff --no-pager`.
- Never edit on `main`. Work on `dev` or a `feat/*`/`fix/*` branch.
- Run with `npm run dev`. Build with `npm run build`.
