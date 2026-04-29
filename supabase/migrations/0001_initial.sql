-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Tags (cuisine and dish share the same table)
CREATE TABLE tags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('cuisine', 'dish')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (name, type)
);

-- Restaurants
CREATE TABLE restaurants (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  address      TEXT,
  postal_code  TEXT,
  location     GEOGRAPHY(POINT, 4326) NOT NULL,
  cost_min     INTEGER,
  cost_max     INTEGER,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Spatial index for geo queries
CREATE INDEX restaurants_location_idx ON restaurants USING GIST (location);

-- Restaurant <-> Tag junction
CREATE TABLE restaurant_tags (
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  tag_id        UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (restaurant_id, tag_id)
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_tags ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "public_read_restaurants"
  ON restaurants FOR SELECT USING (true);

CREATE POLICY "public_read_tags"
  ON tags FOR SELECT USING (true);

CREATE POLICY "public_read_restaurant_tags"
  ON restaurant_tags FOR SELECT USING (true);

-- Owner write (replace 'YOUR-OWNER-UUID' after first login)
-- Run this after you log in and get your user ID:
--   UPDATE pg_policies SET qual = 'auth.uid() = ''<your-actual-uuid>''::uuid'
--   WHERE tablename = 'restaurants' AND policyname = 'owner_write_restaurants';

CREATE POLICY "owner_write_restaurants"
  ON restaurants FOR ALL
  USING (auth.uid() = 'YOUR-OWNER-UUID'::uuid);

CREATE POLICY "owner_write_tags"
  ON tags FOR ALL
  USING (auth.uid() = 'YOUR-OWNER-UUID'::uuid);

CREATE POLICY "owner_write_restaurant_tags"
  ON restaurant_tags FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM restaurants r
      WHERE r.id = restaurant_id AND auth.uid() = 'YOUR-OWNER-UUID'::uuid
    )
  );
