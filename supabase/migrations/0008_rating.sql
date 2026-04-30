ALTER TABLE restaurants
  ADD COLUMN rating TEXT NOT NULL DEFAULT '未评分'
    CHECK (rating IN ('夯', '顶级', '人上人', 'NPC', '拉完了', '未评分'));
