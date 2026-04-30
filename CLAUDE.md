# FoodMap — Project Guide for Claude

## What This Is

A personal Singapore food map. Single-owner (Google OAuth). Public read-only. Owner can add/edit/delete restaurant pins directly on the map.

## Tech Stack

- **Next.js 16** (App Router) + TypeScript
- **MapLibre GL** + react-map-gl (map rendering)
- **OneMap API** — Singapore address/postal search, no API key needed; proxied via `/api/geocode`
- **Supabase** — PostgreSQL + PostGIS + Auth + RLS
- **Google OAuth** — single user login
- **NVIDIA NIM** (`minimax/MiniMax-Text-01`) — LLM natural language filter via `/api/llm-filter`
- **Tailwind CSS v4** + shadcn/ui

## Project Structure

```
app/
  page.tsx                  server component, reads auth user, renders HomePage
  HomePage.tsx              client root: state, filter, sidebar, map/list toggle
  layout.tsx                fonts: Geist Sans, Geist Mono, Instrument Serif
  api/
    restaurants/route.ts    GET (filtered list) + POST (create)
    restaurants/[id]/route.ts  PUT (update) + DELETE
    tags/route.ts           GET all tags + POST (create)
    tags/[id]/route.ts      DELETE
    geocode/route.ts        OneMap proxy
    llm-filter/route.ts     NVIDIA NIM tool-call → FilterPayload
  auth/callback/route.ts    Supabase OAuth callback

components/
  map/
    MapContainer.tsx        map, pins, click-to-add, add/edit mode
    PinMarker.tsx           custom SVG marker + popup
    AddPinModal.tsx         shared modal for add and edit
    EditPinModal.tsx        thin wrapper (delegates to AddPinModal)
  sidebar/
    FilterPanel.tsx         region, cuisine, dish, taste, scene, cost filters + auth
    SmartSearchBar.tsx      LLM search input → FilterPayload
  tags/
    TagInput.tsx            autocomplete tag input with create-on-type
  RestaurantList.tsx        list view of filtered restaurants

lib/
  types.ts                  Tag, Restaurant, RestaurantFormData, FilterPayload, OneMapResult
  constants.ts              SINGAPORE_CENTER, REGION_BOUNDS, preset tags, cuisine colors
  supabase/client.ts        browser Supabase client
  supabase/server.ts        server Supabase client + requireOwner()
  onemap.ts                 OneMap search helper

supabase/migrations/
  0001_initial.sql          tags, restaurants (PostGIS), restaurant_tags, RLS policies
  0002_expand_tag_types.sql add 'taste', 'scene' to tag type constraint
  0003_signature_dishes.sql add signature_dishes TEXT[] column
```

## Key Data Model

```
tags (id, name, type: 'cuisine'|'dish'|'taste'|'scene', created_at)
restaurants (id, name, address, postal_code, location GEOGRAPHY(POINT,4326),
             cost_min, cost_max, notes, signature_dishes TEXT[], created_at, updated_at)
restaurant_tags (restaurant_id, tag_id)  — junction
```

Geography column `location` is stored as PostGIS WKT `POINT(lng lat)`. The GET handler parses the raw EWKB hex back to `[lng, lat]` with `parseEWKBPoint`.

## Auth & Ownership

- `NEXT_PUBLIC_OWNER_USER_ID` env var holds the owner's Supabase user UUID.
- `isOwner` is checked client-side in `HomePage.tsx` for UI gating.
- `requireOwner()` in `lib/supabase/server.ts` enforces it server-side on all write routes.
- RLS policies in Supabase are a second layer: public SELECT, owner-only INSERT/UPDATE/DELETE.

## Tag System

Tags are reused across restaurants. Four types: `cuisine`, `dish`, `taste`, `scene`.

Preset tags live in `lib/constants.ts` (not in DB); the filter UI always shows them. DB tags are merged in at render time. When a user picks a preset tag in the add/edit modal, it's auto-created in the DB if it doesn't exist yet. Preset IDs are prefixed `preset-` and stripped before inserting `restaurant_tags`.

## Filter Pipeline

1. `FilterPanel` builds a `FilterPayload` (all filter dimensions).
2. `HomePage` serializes it into query params → `GET /api/restaurants`.
3. The API filters cost and area_keyword in SQL; tag and region filters run post-query in JS (Supabase JS doesn't support junction-based filtering neatly).
4. `SmartSearchBar` → `POST /api/llm-filter` → returns partial `FilterPayload` → merged into current filters.

## LLM Filter

Uses NVIDIA NIM (`minimax/MiniMax-Text-01`) via OpenAI-compatible API. Forces tool call `apply_filter` with a JSON schema matching `FilterPayload`. System prompt lists available tags in Chinese to ground the model. Env var: `NVIDIA_API_KEY`.

## Environment Variables

See `.env.local.example`. Required:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_OWNER_USER_ID
OWNER_USER_ID
NVIDIA_API_KEY
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
- `--no-pager` goes on `git`, not the subcommand: `git --no-pager diff`, not `git diff --no-pager`.
- Never edit on `main`. Work on `dev` or a `feat/*`/`fix/*` branch.
- Run with `npm run dev`. Build with `npm run build`.
