<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 蜡笔猫导航项目约定

- 首版范围以 `../docs/蜡笔猫导航MVP.md` 的 P0 为唯一边界；`../docs/蜡笔猫导航prd.md` 只作方向参考。
- 分层：页面只组装；业务规则在 `lib/domain`；数据访问只在 `lib/data`；工具逻辑是零 DOM 依赖的纯函数。
- 公共查询必须带 `publishedOnly`；后台每个 server action / route handler 首行调用 `requireAdmin()`。
- 缓存用 `"use cache"` + `cacheTag`（标签见 `lib/cache/tags.ts`），后台写入后在 server action 中 `updateTag`。
- 工具能力只从注册表来；新增工具按 README「新增一个工具」执行。
- 样式只用 CSS Modules + `styles/tokens.css` 变量，不引入外部 CDN。
- 外链仅 https，统一 `target="_blank" rel="noopener noreferrer"`；用户输入/密钥不得进入日志、URL、埋点。
- 提交信息：`类型: 中文改动说明`（feat / fix / docs / style / refactor / perf / test / chore / build / ci）。
