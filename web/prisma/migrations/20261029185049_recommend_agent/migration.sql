-- CreateEnum
CREATE TYPE "ModelPurpose" AS ENUM ('recommend', 'collect', 'enrich', 'term');

-- AlterTable
ALTER TABLE "AgentSetting" ADD COLUMN     "monthlyBudget" DOUBLE PRECISION NOT NULL DEFAULT 30,
ADD COLUMN     "priceInputPerM" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "priceOutputPerM" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "recommendDailyCap" INTEGER NOT NULL DEFAULT 1000,
ADD COLUMN     "recommendEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recommendShare" INTEGER NOT NULL DEFAULT 50;

-- CreateTable
CREATE TABLE "ModelUsageDaily" (
    "day" DATE NOT NULL,
    "purpose" "ModelPurpose" NOT NULL,
    "calls" INTEGER NOT NULL DEFAULT 0,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ModelUsageDaily_pkey" PRIMARY KEY ("day","purpose")
);

-- CreateTable
CREATE TABLE "RecommendCache" (
    "key" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RecommendCache_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "RecommendCache_expiresAt_idx" ON "RecommendCache"("expiresAt");
