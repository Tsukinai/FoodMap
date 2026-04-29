ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS signature_dishes TEXT[] DEFAULT '{}';
