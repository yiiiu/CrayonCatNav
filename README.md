# 蜡笔猫导航 · 项目交接（自主对话迁入，2026-10-08）

## 背景
- 起初做的是个人导航站（v0）：蓝色蜡笔猫（咖啡杯）Logo、粉色纸张 + 手绘油画棒风；参考 Homepage / Dashy / Sun-Panel / OneNav。已实现分组导航、搜索、登录演示、编辑模式、个人中心、管理后台、favicon、私有链接（纯前端内存数据）。原型：prototypes/v0-个人导航.html，平铺图 ui/ui-board.png。
- 用户随后给出 MVP 文档（docs/蜡笔猫导航MVP.md），方向转为 **AI 资源导航 + 在线工具箱**：首页、资源列表/详情、工具中心、MCP 配置生成器、JSON/YAML/TOML 转换、Token 成本估算、仅管理员后台（资源/分类标签/精选）。不做普通用户账号、支付、AI 聊天。

## 产品文档
- docs/蜡笔猫导航prd.md：用户 PRD v1.0（中长期方向基线，2026-10-09 提供）；首版范围以 docs/蜡笔猫导航MVP.md 为准。

## 已交付
- docs/蜡笔猫导航-Agent方案.md：后台资源采集 Agent（已实现，待合 main）与前台推荐 Agent（资源过百后做）的方案与已定事项。
- docs/蜡笔猫导航-v1-架构.md：Next.js App Router + TS、CSS Modules + 蜡笔 token、PostgreSQL + Prisma（pg_trgm）、Auth.js 管理员登录 + requireAdmin、工具纯前端、ISR + revalidateTag、DailyMetric 聚合埋点；分层目录、数据模型补充、安全、5 周开发步骤、测试计划。
- docs/spec/：功能规格（做什么、为什么），如标签治理方案、资源详情页优化方案、自托管部署与定时调度方案、采集关键词 AI 扩词与来源扩展方案。
- docs/plan/：实现计划（任务拆分、文件清单、验收标准），如 AI 批量补全、自托管部署、采集扩词与来源扩展实现计划。
- prototypes/前台.html、工具.html、后台.html：高保真蜡笔风原型，window.showState(id) 切换状态。
  - 前台：home list list-filtered list-empty detail detail-plain notfound tools
  - 工具：mcp mcp-claude mcp-error convert convert-error convert-warn token token-error
  - 后台：login login-error denied resources resource-edit taxonomy featured
- ui/ui-mvp-01~17.jpg：每张 1–2 个界面的高清平铺（01–12 桌面，13–17 手机），打包 ui/蜡笔猫导航-MVP-UI.zip。用户反馈：一张 8 个看不清，偏好每张 1–2 个。
- scripts/cap3.py（Playwright Firefox 整页截图）、board3.py（PIL 拼版，字体 assets/NotoSansSC.ttf）。

## 工程代码
- web/：Next.js 16 工程（2026-10-09 搭骨架），git 仓库在项目根目录，分支 main。ui/ 与字体文件不入库。
- 提交规范：`类型: 中文改动说明`。

## 待定
- 部署区域：国内（需备案）还是海外 —— 已问用户，未答复。
- 首批 30–50 条资源由谁核实录入。
- 下一步候选：确认视觉方案 → 搭工程骨架；或按原型修改 UI。
