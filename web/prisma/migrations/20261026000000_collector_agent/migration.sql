-- 后台采集 Agent + 候选箱（2026-10-26）：Agent 设置单例、采集运行记录、候选资源（永不自动上架）。
-- 由 `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` 生成后手改：
--   1) 增加 trigger / source 取值 CHECK 约束（Prisma 不建模 CHECK，不会产生漂移）；
--   2) 密钥只存 AES-256-GCM 密文与末四位。

-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('pending', 'published', 'drafted', 'rejected');

-- CreateEnum
CREATE TYPE "CollectRunStatus" AS ENUM ('running', 'succeeded', 'failed');

-- CreateTable
CREATE TABLE "AgentSetting" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "baseUrl" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "apiKeyEnc" TEXT,
    "apiKeyLast4" VARCHAR(4),
    "maxPerRun" INTEGER NOT NULL DEFAULT 8,
    "srcMcpRegistry" BOOLEAN NOT NULL DEFAULT true,
    "srcGithub" BOOLEAN NOT NULL DEFAULT true,
    "srcAwesome" BOOLEAN NOT NULL DEFAULT true,
    "srcHuggingface" BOOLEAN NOT NULL DEFAULT true,
    "srcProductHunt" BOOLEAN NOT NULL DEFAULT false,
    "githubTokenEnc" TEXT,
    "githubTokenLast4" VARCHAR(4),
    "phTokenEnc" TEXT,
    "phTokenLast4" VARCHAR(4),
    "lockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectRun" (
    "id" TEXT NOT NULL,
    "trigger" VARCHAR(16) NOT NULL,
    "status" "CollectRunStatus" NOT NULL DEFAULT 'running',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "found" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "notes" JSONB,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,

    CONSTRAINT "CollectRun_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CollectRun_trigger_check" CHECK ("trigger" IN ('manual', 'cron', 'link'))
);

-- CreateTable
CREATE TABLE "ResourceCandidate" (
    "id" TEXT NOT NULL,
    "normalizedUrl" TEXT NOT NULL,
    "urlKeys" TEXT[],
    "status" "CandidateStatus" NOT NULL DEFAULT 'pending',
    "name" TEXT NOT NULL,
    "source" VARCHAR(24) NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "stars" INTEGER,
    "sourceUpdatedAt" TIMESTAMP(3),
    "rawSummary" TEXT NOT NULL DEFAULT '',
    "payload" JSONB NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "linkStatus" INTEGER,
    "runId" TEXT,
    "resourceId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceCandidate_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ResourceCandidate_source_check" CHECK ("source" IN ('mcp_registry', 'github', 'awesome', 'huggingface', 'producthunt', 'manual')),
    CONSTRAINT "ResourceCandidate_confidence_check" CHECK ("confidence" >= 0 AND "confidence" <= 1)
);

-- CreateIndex
CREATE INDEX "CollectRun_startedAt_idx" ON "CollectRun"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceCandidate_normalizedUrl_key" ON "ResourceCandidate"("normalizedUrl");

-- CreateIndex
CREATE INDEX "ResourceCandidate_status_createdAt_idx" ON "ResourceCandidate"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "ResourceCandidate" ADD CONSTRAINT "ResourceCandidate_runId_fkey" FOREIGN KEY ("runId") REFERENCES "CollectRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceCandidate" ADD CONSTRAINT "ResourceCandidate_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
