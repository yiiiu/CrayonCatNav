-- 资源详情页优化：官网预览图 + 结构化详情（核心功能 / 适用场景 / 快速上手 / 平台 / 定价说明）
ALTER TABLE "Resource" ADD COLUMN "previewImageUrl" TEXT;
ALTER TABLE "Resource" ADD COLUMN "details" JSONB NOT NULL DEFAULT '{}';
