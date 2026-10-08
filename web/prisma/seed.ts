/**
 * 种子：初始分类（PRD 4.1）、按工具注册表同步 Tool 表、按环境变量创建首个管理员。
 * 运行：pnpm db:seed
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../generated/prisma/client";
import { toolMetas } from "../lib/tools/metas";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const categories = [
  { slug: "ai-coding", name: "AI 编程" },
  { slug: "mcp", name: "MCP 服务" },
  { slug: "agent-skills", name: "Agent Skills" },
  { slug: "models-api", name: "AI 模型/API" },
  { slug: "github-oss", name: "GitHub 开源项目" },
  { slug: "ai-creation", name: "AI 创作" },
];

async function main() {
  for (const [i, c] of categories.entries()) {
    await prisma.category.upsert({ where: { slug: c.slug }, update: { name: c.name, sortOrder: i }, create: { ...c, sortOrder: i } });
  }

  // 注册表是工具能力唯一来源：只 upsert 名称/描述，不覆盖运营状态与排序
  for (const t of toolMetas) {
    await prisma.tool.upsert({
      where: { slug: t.slug },
      update: { name: t.name, description: t.description },
      create: { slug: t.slug, name: t.name, description: t.description, status: t.defaultStatus, sortOrder: t.sortOrder },
    });
  }

  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (email && password) {
    if (password.length < 12) throw new Error("SEED_ADMIN_PASSWORD 至少 12 位");
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.admin.upsert({ where: { email }, update: {}, create: { email, passwordHash, role: "owner" } });
    console.log(`管理员已就绪：${email}`);
  }
  console.log("种子完成");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
