# 审核 Agent 实现计划

> 规格：`docs/spec/审核Agent方案.md`。分支：`review-agent`。按阶段提交，每阶段 typecheck / lint / test 通过；全部完成后 build、推分支、Vercel 预览验收，再合 main。

## 阶段 1：数据与配置
- [x] 迁移 `review_agent`：ResourceCandidate 加 reviewVerdict / reviewScore / reviewNotes / reviewedBy / aiReviewedAt；AgentSetting 加 reviewMode / reviewPublishAs / reviewApproveScore / reviewRejectScore / reviewDailyPublishCap / reviewMaxPerRun；ModelPurpose 加 review。
- [x] `lib/agent/budget.ts`：modelPurposes / purposeLabels 加 review。
- [x] `lib/validation/agent.ts`：审核设置的表单校验（阈值 0–100，拒绝 < 上架，上限 0–50）。

## 阶段 2：纯逻辑（lib/agent/review.ts，全部单测）
- [x] `rules.ts`：`runRules(candidate, ctx)` → `{ hard: Issue[], soft: Issue[] }`（链接状态、重复、schema、分类 / 标签、长度、archived/陈旧、低置信度）。
- [x] `prompt.ts`：审核系统提示词 + 用户提示词构建（资料分隔、反注入说明）。
- [x] `parse.ts`：模型输出 zod 解析，fixes 字段白名单，失败返回 unsure。
- [x] `decide.ts`：`decide({ rules, model, settings, todayPublished, categoryCount })` → `publish | draft | reject | human`，含每日上限与新分类保护。
- [x] `apply.ts`：把 fixes 合并进 payload（标签只保留现有标签）。

## 阶段 3：服务层
- [x] `lib/domain/review.service.ts`：
  - `reviewCandidate(id)`：取资料（复用 safe-fetch、htmlToText、readme 抓取）→ 规则 → 预算检查 → `trackedChat("review")` → 解析 → 决策 → 执行（复用 `convertCandidate` 的核心路径，抽出不依赖表单的内部函数；拒绝复用 `rejectCandidate`）→ 写回 review 字段。
  - `reviewPending({ limit, trigger })`：按 createdAt 取未审核的 pending 候选，逐条处理，汇总结果；时间预算 240s 内停止。
- [x] `lib/data/candidate.repo.ts`：查询未审核候选、写 review 字段、统计今日 AI 上架数、各分类已发布数。
- [x] `convertCandidate` / `rejectCandidate` 加 actor 参数（human | ai），人工与 AI 共用同一上架路径。

## 阶段 4：触发入口
- [x] `/api/cron/review`（CRON_SECRET 鉴权，复用 cron-auth），`vercel.json` 加 `0 2 * * *`。
- [x] 后台 Server Action：`reviewPendingAction`（候选箱按钮）、`reviewOneAction`（单条审核 / 重审）、`adoptAiSuggestionAction`（采纳建议并上架）。改回草稿复用资源编辑页的状态字段（编辑页顶部有 AI 上架提示）。
- [ ] 采集完成提示里加「去审核」入口（未做：候选箱已有按钮）。

## 阶段 5：后台界面
- [x] 候选箱：AI 徽章 / 分数 / 问题清单（HelpTip 展开）、「需人工」置顶、筛选（全部 / 需人工 / 建议上架 / 建议拒绝）、「采纳 AI 建议」按钮（ConfirmButton）。
- [x] Agent 设置页：审核模式（ui Select）、上架去向、阈值、每日上限、每次最多条数。
- [x] 总览：AI 自动处理（近 7 天）+ 建议模式一致率；花费面板加「审核」一行。
- [x] 资源编辑页：AI 上架提示 + 改回草稿。

## 阶段 6：文档与验收
- [x] 更新 v1 架构 §9 工程记录、规格状态。
- [ ] 预览环境：建议模式审 20 条历史候选 → 核对一致率 → 自动模式审 10 条 → 检查撤回。
- [ ] 合 main，生产先保持建议模式（或按用户决定）。

## 风险与处理
- Vercel Hobby 函数时长：每次最多 reviewMaxPerRun 条 + 240s 时间预算，剩余下次处理。
- 模型幻觉导致误上架：建议模式先行、每日上限、新分类保护、上架后可一键撤回、总览抽查。
- 资料抓取失败：只凭 payload 无法核实真实性 → 一律 unsure 留人工。
