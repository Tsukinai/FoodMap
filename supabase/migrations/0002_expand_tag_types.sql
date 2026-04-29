-- Expand tag type constraint to support taste and scene
ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_type_check;
ALTER TABLE tags ADD CONSTRAINT tags_type_check
  CHECK (type IN ('cuisine', 'dish', 'taste', 'scene'));
