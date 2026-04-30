ALTER TABLE restaurants
  ADD COLUMN status TEXT NOT NULL DEFAULT 'visited'
    CHECK (status IN ('want', 'visited'));
