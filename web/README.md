# 蜡笔猫导航 · Web

AI 资源导航 + 在线工具箱（MVP P0）。需求见 `../docs/蜡笔猫导航MVP.md`，方向见 `../docs/蜡笔猫导航prd.md`，架构见 `../docs/蜡笔猫导航-v1-架构.md`。

## 技术栈
Next.js 16（App Router、Cache Components）· TypeScript · CSS Modules + 蜡笔 token · PostgreSQL + Prisma 7（adapter-pg）· Auth.js v5（仅管理员）· Vitest · 部署：Vercel + 托管 Postgres（海外）

## 本地启动
```bash
pnpm install                 # 自动 prisma generate
cp .env.example .env         # 填 DATABASE_URL、AUTH_SECRET、SEED_ADMIN_*
pnpm db:migrate              # 需要 PostgreSQL 15+（NULLS NOT DISTINCT、pg_trgm）
pnpm db:seed                 # 6 个分类、3 个工具、首个管理员
pnpm dev
```

## 常用命令
| 命令 | 作用 |
|---|---|
| `pnpm build` | 生产构建 |
| `pnpm typecheck` | TS 类型检查 |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest 单元测试 |

## 目录
```
app/(public)/      前台：首页、/resources、/tools/[slug]
app/admin/         后台：login + (protected) 受保护路由
lib/tools/         工具注册表（registry.ts / metas.ts）与各工具逻辑
lib/data/          Prisma 仓储层（publishedOnly 防草稿泄漏）
lib/auth/          Auth.js 配置、requireAdmin、登录限流
lib/validation/    zod schema（前后端共用）
components/        ui / layout / tool
styles/tokens.css  蜡笔风设计 token
proxy.ts           /admin 第一层守卫（Next 16 的 middleware）
```

## 新增一个工具
1. `lib/tools/{slug}/meta.ts`（元数据）+ 纯函数逻辑与测试
2. `components/tool/{Name}Tool.tsx`（UI，客户端组件）
3. 在 `lib/tools/metas.ts` 与 `lib/tools/registry.ts` 各登记一行
4. `pnpm db:seed` 同步 Tool 表

## 提交规范
`类型: 中文改动说明`，类型取 feat / fix / docs / style / refactor / perf / test / chore / build / ci。
