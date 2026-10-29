# AI 批量补全：实现计划

> 规格见 `docs/spec/资源详情页优化方案.md` 第一期「内容来源」。本文是可执行的实现计划：改哪些文件、按什么顺序、怎么验收。

## 1. 目标

已有资源（第一期上线前录入的 60 多条）没有结构化详情和预览图。提供后台入口，让模型根据官网首页与 GitHub README 生成「核心功能 / 适合谁 / 快速上手 / 平台 / 定价说明」并抓取预览图，人工核对后对外展示更完整的详情页。

## 2. 关键决策

| 问题 | 决定 | 理由 |
| --- | --- | --- |
| 生成结果直接写入还是存草稿 | **只填空字段，直接写入**；已有内容一律不覆盖 | 空字段没有可丢失的内容；60 多条逐条「采用草稿」审核成本太高 |
| 怎么让人工核对 | 资源打 `aiReview = true`（「AI 待核对」），后台列表可筛选；管理员在编辑页保存一次即视为已核对 | 不增加新页面，复用现有编辑流程 |
| 如何避免反复处理同一条 | 记录 `aiEnrichedAt`（每次尝试都写，含失败/无产出）；批量只挑从未尝试过的 | 资料不足的资源不会每次都重跑、白花 token |
| 单条入口 | 编辑页「AI 补全」按钮，忽略 `aiEnrichedAt`，同样只填空字段 | 管理员可对个别资源手动重试 |
| 资料来源 | 官网首页 HTML（标题、meta 描述、正文文本，≤6000 字）+ GitHub README（≤8000 字） | 都走 safe-fetch（SSRF 防护）；不调用搜索，不编造 |
| 一次处理多少 | 批量每次最多 10 条、并发 3；入口放「采集 Agent」页（maxDuration 300 秒） | 留足 Vercel 函数时长余量；复用已配置的模型 |
| 草稿 / 已下架资源 | 都处理 | 草稿将来也要发布 |

## 3. 数据变更

迁移 `20261026040000_resource_ai_enrich`：

```sql
ALTER TABLE "Resource" ADD COLUMN "aiEnrichedAt" TIMESTAMP(3);
ALTER TABLE "Resource" ADD COLUMN "aiReview" BOOLEAN NOT NULL DEFAULT false;
```

- 后台表单保存资源时写 `aiReview = false`（视为已核对）。
- 不纳入 `resourceInputSchema`，由 service 层控制。

## 4. 任务拆分（按顺序）

1. **纯函数（可单测）** — `web/lib/agent/enrich.ts`
   - `htmlToText(html)`：去 script/style/注释与标签，取 title、meta description、正文，压缩空白并截断。
   - `buildEnrichPrompt(resource, material)` 与 `ENRICH_SYSTEM_PROMPT`：只依据给定资料；无明确来源的 quickstart / 定价留空。
   - `mergeDetails(current, generated, currentPreview, newPreview)`：只填空字段，返回新值与「填了哪些字段」。
   - 测试：`enrich.test.ts`。
2. **资料抓取** — `web/lib/agent/safe-fetch.ts` 新增 `fetchEnrichMaterial(websiteUrl, githubUrl)`：抓官网 HTML（同时解析 og:image）与 README（`raw.githubusercontent.com/<repo>/HEAD/README.md`，失败再试 `readme.md`），任何一项失败都不抛错。
3. **数据层** — `web/lib/data/resource.repo.ts`
   - `listEnrichCandidates()`：未尝试过（`aiEnrichedAt` 为空）的资源基本字段；由 service 用 `readDetails/hasDetails` 过滤出「详情为空或缺预览图」的。
   - `saveEnrichment(id, { details?, previewImageUrl?, aiReview })`：写入并更新 `aiEnrichedAt`。
   - `adminSearch` 支持 `ai=review` 筛选。
4. **领域层** — `web/lib/domain/enrich.service.ts`
   - `enrichOne(id)`：抓资料 → 调模型（JSON 输出，不合格重试 1 次）→ `cleanModelDetails` → `mergeDetails` → 写库。无资料时只记录尝试。
   - `enrichBatch(limit = 10)`：挑选待补全资源，并发 3 执行，汇总「补全 x 条 / 无可用资料 y 条 / 失败 z 条 / 剩余 n 条」。
   - `countEnrichPending()`：给后台展示剩余数量。
5. **Server Actions** — `app/admin/(protected)/actions.ts`
   - `enrichBatchAction`、`enrichOneAction(id)`；成功后 `touchResources(...slugs)` 刷新前台缓存。
   - `saveResourceAction` 保存时清除 `aiReview`（在 `resource.service.saveResource` 内）。
6. **后台界面**
   - 采集 Agent 页新增「资源 AI 补全」卡片（`components/admin/EnrichPanel.tsx`）：显示剩余数量、按钮「补全下一批（10 条）」、结果提示与「去核对」链接。
   - 资源编辑页：顶部「AI 补全」按钮（编辑页设 `maxDuration = 60`），`aiReview` 时显示提示「这条资源的详情由 AI 补全，请核对后保存」。
   - 资源列表：名称旁「AI 待核对」标记；状态筛选旁加「AI 待核对」筛选。
7. **文档**：架构 §9 补一节；项目简报更新。

## 5. 验收标准

- 单元测试覆盖 htmlToText、mergeDetails（不覆盖已有字段）、提示词关键约束；全量测试、typecheck、lint 通过。
- 预览环境：
  1. 采集 Agent 页显示待补全数量；点一次处理 ≤10 条，耗时在函数上限内，提示统计正确。
  2. 抽查 3 条：详情页出现「它能做什么 / 适合谁」，内容与官网一致；已有字段未被改动。
  3. 资源列表能筛出「AI 待核对」；在编辑页保存后标记消失。
  4. 单条「AI 补全」可对已尝试过的资源重跑。
  5. 模型未配置时给出明确提示，不报 500。

## 6. 风险与对策

- **模型编造**：提示词强约束 + 只给抓到的资料 + 人工核对标记；quickstart/定价无来源留空。
- **官网抓取失败 / 反爬**：退回仅用 README 与现有 summary/description；仍无资料则只记尝试。
- **费用**：每条约 1 次调用（≤2 次），10 条/批，由管理员手动触发；暂不做自动定时补全。
- **函数超时**：单条模型超时 45 秒，批量并发 3、上限 10 条。

## 7. 不在本次范围

- 自动定时补全、图片转存、GitHub Star 等活数据（第二期）、SoftwareApplication 结构化数据。

## 8. 实现状态（2026-10-26）
- 任务 1–7 已完成，未偏离计划：`lib/agent/enrich.ts`（+测试）、`safe-fetch.fetchEnrichMaterial`、`resource.repo` 补全相关查询、`lib/domain/enrich.service.ts`、`enrichBatchAction / enrichOneAction`、`components/admin/EnrichButton.tsx`、采集 Agent 页「资源 AI 补全」卡片、编辑页按钮与提示、资源列表「AI 待核对」标记与筛选。
- 已于 2026-10-29 随 collector-agent 合入 main。

## 9. 迭代：定价抓取（2026-10-26）
- 问题：Cursor 等产品首页不写价格，只在 `/pricing`，原先只抓首页，模型拿不到定价。
- 改动：`findPricingUrls` 从首页链接里找同站定价页（排除联系销售/登录，短路径优先，找不到退回 `/pricing`），最多试 3 个；`pricingExcerpt` 只保留含价格的行及套餐名（≤3000 字）作为「定价页摘录」给模型。首页抓取上限放宽到 1MB。
- 模型同时给出 `pricingType`，仅在资源当前为「未知」时填入。
- 单条补全：主要字段（核心功能 / 适合谁 / 平台 / 定价说明 / 定价类型）任一为空就调模型，只填空字段；已补全过的资源可在编辑页单条重跑补定价。
