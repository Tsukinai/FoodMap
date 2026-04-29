# FoodMap 部署指南

## 1. Supabase 设置

1. 前往 [supabase.com](https://supabase.com) 创建新项目（免费 tier）
2. Dashboard → Database → Extensions → 启用 `postgis`
3. SQL Editor → 粘贴并执行 `supabase/migrations/0001_initial.sql`
4. Authentication → Providers → Google → 启用，填入 Client ID/Secret
   - 需要在 [Google Cloud Console](https://console.cloud.google.com) 创建 OAuth 2.0 凭据
   - Authorized redirect URI: `https://<your-project>.supabase.co/auth/v1/callback`
5. Authentication → URL Configuration:
   - Site URL: `https://your-vercel-domain.vercel.app`
   - Redirect URLs: `https://your-vercel-domain.vercel.app/auth/callback`

## 2. 首次登录获取 Owner User ID

部署后访问网站 → 点击「登录编辑」→ Google 登录完成后：

1. Supabase Dashboard → Authentication → Users
2. 复制你的 user UUID
3. 在 SQL Editor 执行以下更新（替换三处 `YOUR-ACTUAL-UUID`）：

```sql
-- 更新 RLS 策略中的 owner UUID
DROP POLICY IF EXISTS "owner_write_restaurants" ON restaurants;
CREATE POLICY "owner_write_restaurants"
  ON restaurants FOR ALL
  USING (auth.uid() = 'YOUR-ACTUAL-UUID'::uuid);

DROP POLICY IF EXISTS "owner_write_tags" ON tags;
CREATE POLICY "owner_write_tags"
  ON tags FOR ALL
  USING (auth.uid() = 'YOUR-ACTUAL-UUID'::uuid);

DROP POLICY IF EXISTS "owner_write_restaurant_tags" ON restaurant_tags;
CREATE POLICY "owner_write_restaurant_tags"
  ON restaurant_tags FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM restaurants r
      WHERE r.id = restaurant_id AND auth.uid() = 'YOUR-ACTUAL-UUID'::uuid
    )
  );
```

4. 在 Vercel 环境变量中设置 `OWNER_USER_ID` 和 `NEXT_PUBLIC_OWNER_USER_ID` 为你的 UUID → 重新部署

## 3. Vercel 部署

```bash
# 推送到 GitHub
git init
git add .
git commit -m "feat: initial foodmap app"
git remote add origin https://github.com/your-username/foodmap.git
git push -u origin main
```

然后在 [vercel.com](https://vercel.com) 导入 GitHub 仓库，设置以下环境变量：

```
NEXT_PUBLIC_SUPABASE_URL        = https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY   = eyJ...
SUPABASE_SERVICE_ROLE_KEY       = eyJ...
NEXT_PUBLIC_OWNER_USER_ID       = (首次登录后填写)
OWNER_USER_ID                   = (首次登录后填写)
ANTHROPIC_API_KEY               = sk-ant-...
```

## 4. 本地开发

```bash
cp .env.local.example .env.local
# 编辑 .env.local 填入真实值
node node_modules/next/dist/bin/next dev
```

> npm 的 .bin/next 在 Node.js v25 有路径问题，用完整路径调用。

## 注意事项

- **OneMap 归因**：地图底部必须显示 "Map © OneMap | Singapore Land Authority"（已内置）
- **Supabase 免费 tier**：7 天无活动会暂停，设置 UptimeRobot 定时 ping 可避免
- **LLM filter**：每次调用约 $0.001，个人使用基本忽略不计
