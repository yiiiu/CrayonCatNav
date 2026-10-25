-- 标签治理第一阶段（2026-10-26）：标签别名 + 待定池。见 docs/plan/标签治理方案.md。
-- 由 `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` 生成，不写数据。

-- CreateEnum
CREATE TYPE "TagSuggestionStatus" AS ENUM ('open', 'accepted', 'merged', 'ignored');

-- AlterTable
ALTER TABLE "Tag" ADD COLUMN     "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "TagSuggestion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "TagSuggestionStatus" NOT NULL DEFAULT 'open',
    "hits" INTEGER NOT NULL DEFAULT 1,
    "candidateIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tagId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TagSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TagSuggestion_slug_key" ON "TagSuggestion"("slug");

-- CreateIndex
CREATE INDEX "TagSuggestion_status_hits_idx" ON "TagSuggestion"("status", "hits");

-- AddForeignKey
ALTER TABLE "TagSuggestion" ADD CONSTRAINT "TagSuggestion_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE SET NULL ON UPDATE CASCADE;

