-- 按分类定向采集（2026-10-26）：分类采集配置表 + 运行记录的目标分类。
-- 由 `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` 生成。
-- 6 个初始分类的默认配置由 prisma/seed.ts 只在缺失时补齐（与「种子只补缺不覆盖」约定一致），迁移不写数据。

-- AlterTable
ALTER TABLE "CollectRun" ADD COLUMN     "categoryId" TEXT;

-- CreateTable
CREATE TABLE "CategoryCollectConfig" (
    "categoryId" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryCollectConfig_pkey" PRIMARY KEY ("categoryId")
);

-- CreateIndex
CREATE INDEX "CollectRun_categoryId_idx" ON "CollectRun"("categoryId");

-- AddForeignKey
ALTER TABLE "CollectRun" ADD CONSTRAINT "CollectRun_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryCollectConfig" ADD CONSTRAINT "CategoryCollectConfig_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
