-- CreateEnum
CREATE TYPE "ReviewVerdict" AS ENUM ('none', 'approve', 'reject', 'unsure');

-- CreateEnum
CREATE TYPE "ReviewActor" AS ENUM ('human', 'ai');

-- CreateEnum
CREATE TYPE "ReviewMode" AS ENUM ('off', 'suggest', 'auto');

-- AlterEnum
ALTER TYPE "ModelPurpose" ADD VALUE 'review';

-- AlterTable
ALTER TABLE "AgentSetting" ADD COLUMN     "reviewApproveScore" INTEGER NOT NULL DEFAULT 80,
ADD COLUMN     "reviewDailyPublishCap" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "reviewMaxPerRun" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "reviewMode" "ReviewMode" NOT NULL DEFAULT 'suggest',
ADD COLUMN     "reviewPublishDraft" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reviewRejectScore" INTEGER NOT NULL DEFAULT 40;

-- AlterTable
ALTER TABLE "ResourceCandidate" ADD COLUMN     "aiReviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewNotes" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "reviewScore" INTEGER,
ADD COLUMN     "reviewVerdict" "ReviewVerdict" NOT NULL DEFAULT 'none',
ADD COLUMN     "reviewedBy" "ReviewActor";

-- CreateIndex
CREATE INDEX "ResourceCandidate_status_aiReviewedAt_idx" ON "ResourceCandidate"("status", "aiReviewedAt");
