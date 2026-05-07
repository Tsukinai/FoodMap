## TODO

### 功能

- [ ] 餐馆照片上传（Supabase Storage）

- [x] About 页
- [ ] 从夯到拉排名页面
- [x] 移动端小三角挡住了全部餐厅字样
- [x] 小三角改为三条杠
- [x] 卡片层级混乱
- [x] 名称搜索
- [ ] 推荐系统 llm rag
- [x] 根据地点做聚类，增加地点
- [x] 新菜品菜系添加emoji等

### 技术债

- [ ] tag filter 目前在 JS 端做后过滤，数据量大时效率低 — 改为 PostgREST `?junction.tag_id=in.(...)` 查询
- [ ] `FilterPayload` 在客户端序列化成 query string 传给 API，考虑改为 POST body 减少 URL 长度限制风险
- [ ] 补充 E2E 测试（Playwright），覆盖添加 Pin → 筛选 → 编辑 → 删除完整流程
- [ ] 搭建 Supabase 本地开发环境（`supabase start`），替代直连远端 dev 项目

### 体验优化

- [ ] 侧边栏折叠状态持久化到 localStorage
- [ ] 深色模式支持
