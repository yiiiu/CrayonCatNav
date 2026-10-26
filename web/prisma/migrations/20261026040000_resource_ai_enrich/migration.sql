-- AI 批量补全：尝试时间 + 待核对标记（见 docs/plan/AI批量补全-实现计划.md）
ALTER TABLE "Resource" ADD COLUMN "aiEnrichedAt" TIMESTAMP(3);
ALTER TABLE "Resource" ADD COLUMN "aiReview" BOOLEAN NOT NULL DEFAULT false;
