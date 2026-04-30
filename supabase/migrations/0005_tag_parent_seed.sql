-- Add parent_id for tag hierarchy (e.g. sub-cuisines under 中餐, 西餐, etc.)
ALTER TABLE tags ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES tags(id) ON DELETE SET NULL;

-- ── Cuisine top-level ──────────────────────────────────────────────────────
INSERT INTO tags (name, type) VALUES
  ('中餐',    'cuisine'),
  ('东南亚菜', 'cuisine'),
  ('韩餐',    'cuisine'),
  ('日料',    'cuisine'),
  ('泰餐',    'cuisine'),
  ('西餐',    'cuisine'),
  ('甜品',    'cuisine')
ON CONFLICT (name, type) DO NOTHING;

-- ── Chinese sub-cuisines → parent = 中餐 ───────────────────────────────────
WITH parent AS (SELECT id FROM tags WHERE name = '中餐' AND type = 'cuisine')
INSERT INTO tags (name, type, parent_id)
SELECT v.name, 'cuisine', parent.id
FROM (VALUES ('粤菜'), ('川菜'), ('云南菜'), ('湘菜'), ('新疆菜')) AS v(name)
CROSS JOIN parent
ON CONFLICT (name, type) DO UPDATE SET parent_id = EXCLUDED.parent_id;

-- ── Dish ──────────────────────────────────────────────────────────────────
INSERT INTO tags (name, type) VALUES
  ('炸鸡汉堡', 'dish'),
  ('烧烤',    'dish'),
  ('烤肉',    'dish'),
  ('披萨',    'dish'),
  ('炒菜',    'dish'),
  ('漂亮饭',  'dish')
ON CONFLICT (name, type) DO NOTHING;

-- ── Taste ─────────────────────────────────────────────────────────────────
INSERT INTO tags (name, type) VALUES
  ('不辣', 'taste'),
  ('微辣', 'taste'),
  ('特辣', 'taste')
ON CONFLICT (name, type) DO NOTHING;

-- ── Scene ─────────────────────────────────────────────────────────────────
INSERT INTO tags (name, type) VALUES
  ('早餐',      'scene'),
  ('brunch',   'scene'),
  ('正餐',      'scene'),
  ('夜宵',      'scene'),
  ('下午茶/甜点', 'scene')
ON CONFLICT (name, type) DO NOTHING;
