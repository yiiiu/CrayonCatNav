-- 自建访问统计（2026-10-25）：页面浏览按日聚合 + 当日去重访客 + 每日轮换盐。
-- 由 `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` 生成后手改：
--   1) 增加 source / device 取值 CHECK 约束（Prisma 不建模 CHECK，不会产生漂移）；
--   2) 只存域名与哈希，不存 IP / UA / 完整 URL。

-- CreateTable
CREATE TABLE "PageViewDaily" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "path" VARCHAR(160) NOT NULL,
    "source" VARCHAR(16) NOT NULL,
    "refDomain" VARCHAR(253) NOT NULL DEFAULT '',
    "device" VARCHAR(8) NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PageViewDaily_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PageViewDaily_source_check" CHECK ("source" IN ('direct', 'internal', 'google', 'bing', 'other_search', 'social', 'referral')),
    CONSTRAINT "PageViewDaily_device_check" CHECK ("device" IN ('desktop', 'mobile', 'tablet'))
);

-- CreateTable
CREATE TABLE "DailyVisitor" (
    "date" DATE NOT NULL,
    "hash" VARCHAR(32) NOT NULL,

    CONSTRAINT "DailyVisitor_pkey" PRIMARY KEY ("date","hash")
);

-- CreateTable
CREATE TABLE "AnalyticsSalt" (
    "date" DATE NOT NULL,
    "salt" VARCHAR(64) NOT NULL,

    CONSTRAINT "AnalyticsSalt_pkey" PRIMARY KEY ("date")
);

-- CreateIndex
CREATE INDEX "PageViewDaily_date_idx" ON "PageViewDaily"("date");

-- CreateIndex
CREATE UNIQUE INDEX "PageViewDaily_date_path_source_refDomain_device_key" ON "PageViewDaily"("date", "path", "source", "refDomain", "device");
