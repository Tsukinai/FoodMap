# LLM 推荐系统改进计划

按性价比排序，改一条删一条。改完后从本文件移除。

---

## 1. 加 ranking（rating + 命中数加权）

**问题**

`app/api/recommend/route.ts:260` 直接 `results.slice(0, 8)`，前面没有任何 ORDER BY 也没有 JS 排序。如果 30 家匹配，截断的 8 家由 Supabase 返回顺序决定，等于"随机抽样"——把"推荐"做成了运气活。

**做法**

加一个加权打分函数，`slice(0, 8)` 之前按分数降序排：

- rating: 夯=5 / 顶级=4 / 人上人=3 / NPC=2 / 拉完了=1 / 未评分=0（权重最大，比如 ×3）
- tag 命中数: 命中 cuisine/dish/taste/scene 越多分越高（每命中一类 +1）
- 距离（仅 near_location 时）：(radius - dist) / radius，越近越高
- tie-breaker: created_at desc（新加的优先露出）

**完成判据**

- 同样 query 下，高 rating 的店稳定在前；命中多个 tag 的店比命中一个的靠前。

---

## 2. stage C 拿到 filter 上下文

**问题**

`app/api/recommend/route.ts:287-303` stage C 的 system prompt 只塞了候选餐馆列表，**完全不知道 stage A 提取的 filter**。0 结果时只能写"试试附近 X 区"这种空话，明明可以基于"用户筛了 Clementi + 中餐 + 30 元以下"给针对性放宽建议。

**做法**

把 normalize 后的 filter 摘要也写进 stage C system prompt：

```
用户筛选条件：菜系=中餐，区域=Clementi，预算≤30
匹配结果：0 家
```

prompt 里加一条规则："如果 0 结果，基于上面的筛选条件给一条具体的放宽建议（比如指出哪个条件是瓶颈）"。

**完成判据**

- 0 结果时，LLM 输出能引用具体的筛选维度（不是泛泛的"换个菜系"）。

---

## 3. 强制 tool_choice + 空 args 走澄清

**问题**

- `app/api/recommend/route.ts:169` `tool_choice: 'auto'` + prompt 写"必须调用此工具" 是矛盾的，模型可以不调。
- 不调或 args 全空时（`route.ts:218-219` 不会加任何 filter），直接返回数据库前 8 家，用户拿到的是垃圾结果——且无法区分"用户没指定"和"用户说随便"。

**做法**

- `tool_choice: { type: 'function', function: { name: 'search_restaurants' } }` 强制调用。
- 检测空 args（所有 filter 字段都为空/undefined）时，跳过 stage B 的全量返回，直接进 stage C 让模型反问澄清（"想吃什么菜系？预算多少？哪个区？任意一个都行"），不走推荐文案分支。
- 如果 LLM 真的想"全店主推"，让它显式传一个 `random: true` 字段，服务端走 rating 加权随机。

**完成判据**

- 空 query 不会再返回数据库前 8 家随便挑的店。
- LLM 不会"忘记"调用工具。

---

## 4. 建 golden set + 加结构化日志

**问题**

现在改 prompt 完全凭感觉，没有量化抓手。`console.log` 也只够手动调试，没有可分析的轨迹。

**做法**

- 写一个 `scripts/eval-recommend.ts`：读取 `tests/recommend-golden.json`（30 条左右 query，每条标注期望命中的 restaurant_id 集合），跑一遍打印 recall@8 / 平均匹配数 / LLM 幻觉 tag 比例。
- `route.ts` 里换成结构化 log：每次请求记录 `{ query, raw_args, normalized_filter, dropped_tags, candidate_count, matched_ids, stage_a_ms, stage_c_ms }`。
- 不需要外部日志系统，先 `console.log(JSON.stringify({...}))`，方便后续 grep/jq 分析。

**完成判据**

- 跑一次 `npm run eval:recommend` 能打出 recall@8。
- 改 prompt 之后能用同一份 golden set 对比前后。
