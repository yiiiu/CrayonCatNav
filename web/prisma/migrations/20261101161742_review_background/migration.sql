-- AlterTable
ALTER TABLE "AgentSetting" ADD COLUMN     "reviewLastAt" TIMESTAMP(3),
ADD COLUMN     "reviewLastResult" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "reviewLockedUntil" TIMESTAMP(3);
