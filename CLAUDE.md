# FoodMap — Project Guide for Claude

## What This Is

A personal Singapore food map. Single-owner (Google OAuth). Public read-only. Owner can add/edit/delete restaurant pins directly on the map.

## Tech Stack

- **Next.js 16** (App Router) + TypeScript
- **MapLibre GL** + react-map-gl (map rendering)
- **OneMap API** — Singapore address/postal search, no API key needed; proxied via `/api/geocode`
- **Supabase** — PostgreSQL + PostGIS + Auth + RLS
- **Google OAuth** — single user login; any authenticated user can post to guestbook, owner can reply/delete
- **Tailwind CSS v4** + shadcn/ui

## Project Structure

```
app/
  page.tsx                  server component, reads auth user, renders HomePage
  HomePage.tsx              client root: state, filter, sidebar, map/list toggle
  layout.tsx                fonts: Geist Sans, Geist Mono, Instrument Serif
  tags/
    page.tsx                tags management page (owner only)
    TagsManager.tsx         drag-and-drop tag sort, create/delete tags
  api/
    restaurants/route.ts    GET (filtered list) + POST (create)
    restaurants/[id]/route.ts  PUT (update) + DELETE
    tags/route.ts           GET all tags + POST (create)
    tags/[id]/route.ts      DELETE
    messages/route.ts       GET + POST guestbook messages
    messages/[id]/route.ts  PUT (owner reply) + DELETE (owner only)
    geocode/route.ts        OneMap proxy
  auth/callback/route.ts    Supabase OAuth callback

components/
  map/
    MapContainer.tsx        map, pins, click-to-add, add/edit mode; spiderfy overlapping pins
    PinMarker.tsx           custom SVG marker + popup
    AddPinModal.tsx         shared modal for add and edit
    EditPinModal.tsx        thin wrapper (delegates to AddPinModal)
  sidebar/
    FilterPanel.tsx         cuisine (expandable sub-cuisine), dish, taste, scene, cost filters
  tags/
    TagInput.tsx            autocomplete tag input with create-on-type
  guestbook/
    GuestbookPanel.tsx      guestbook: list messages, post, owner reply/delete
  AuthButton.tsx            sign-in / sign-out button
  DisclaimerModal.tsx       first-visit disclaimer, dismissal stored in localStorage
  RestaurantList.tsx        list view of filtered restaurants

lib/
  types.ts                  Tag, Restaurant, RestaurantFormData, FilterPayload, OneMapResult
  constants.ts              SINGAPORE_CENTER, preset tags (with parent hierarchy), cuisine colors
  supabase/client.ts        browser Supabase client
  supabase/server.ts        server Supabase client + requireOwner()
  onemap.ts                 OneMap search helper

supabase/migrations/
  0001_initial.sql          tags, restaurants (PostGIS), restaurant_tags, RLS policies
  0002_expand_tag_types.sql add 'taste', 'scene' to tag type constraint
  0003_signature_dishes.sql add signature_dishes TEXT[] column
  0004_status.sql           add status ('want'|'visited') to restaurants
  0005_tag_parent_seed.sql  add parent_id to tags; seed all preset tags with hierarchy
  0006_tag_sort_order.sql   add sort_order to tags
  0007_messages.sql         guestbook messages table + RLS
```

## Key Data Model

```
tags (id, name, type: 'cuisine'|'dish'|'taste'|'scene', parent_id UUID, sort_order INT, created_at)
restaurants (id, name, address, postal_code, location GEOGRAPHY(POINT,4326),
             cost_min, cost_max, notes, signature_dishes TEXT[],
             status TEXT ('want'|'visited'), created_at, updated_at)
restaurant_tags (restaurant_id, tag_id)  — junction
messages (id, user_id, author_name, author_avatar, content, reply, replied_at, created_at)
```

Geography column `location` is stored as PostGIS WKT `POINT(lng lat)`. The GET handler parses the raw EWKB hex back to `[lng, lat]` with `parseEWKBPoint`.

Tag `parent_id` supports sub-cuisine hierarchy (e.g. 粤菜/川菜 under 中餐). Top-level cuisine tags have `parent_id = NULL`.

## Auth & Ownership

- `NEXT_PUBLIC_OWNER_USER_ID` env var holds the owner's Supabase user UUID.
- `isOwner` is checked client-side in `HomePage.tsx` for UI gating.
- `requireOwner()` in `lib/supabase/server.ts` enforces it server-side on all write routes.
- RLS policies in Supabase are a second layer: public SELECT, owner-only INSERT/UPDATE/DELETE.

## Tag System

Tags are reused across restaurants. Four types: `cuisine`, `dish`, `taste`, `scene`.

All preset tags are seeded into the DB (migration `0005`) with `parent_id` hierarchy for cuisine sub-tags. The old client-side `preset-` ID fallback is removed — tags always come from DB. `sort_order` controls display order and is editable via drag-and-drop in `/tags`.

## Filter Pipeline

1. `FilterPanel` builds a `FilterPayload` (cuisine, dish, taste, scene, cost).
2. `HomePage` serializes it into query params → `GET /api/restaurants`.
3. The API filters cost in SQL; tag filters run post-query in JS (Supabase JS doesn't support junction-based filtering neatly).

Cuisine filter supports hierarchy: selecting a parent tag includes all its sub-tags.

## Environment Variables

See `.env.local.example`. Required:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_OWNER_USER_ID
OWNER_USER_ID
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
