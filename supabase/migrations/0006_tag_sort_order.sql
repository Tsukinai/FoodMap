ALTER TABLE tags ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

-- Initialize existing tags alphabetically within each (type, parent_id) group
WITH ranked AS (
  SELECT id,
    (ROW_NUMBER() OVER (
      PARTITION BY type, parent_id
      ORDER BY name
    ) - 1) AS rn
  FROM tags
)
UPDATE tags SET sort_order = ranked.rn
FROM ranked
WHERE tags.id = ranked.id;
