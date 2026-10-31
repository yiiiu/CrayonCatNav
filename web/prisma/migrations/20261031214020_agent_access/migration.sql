-- CreateEnum
CREATE TYPE "AgentApiChannel" AS ENUM ('http', 'mcp');

-- CreateTable
CREATE TABLE "AgentApiDaily" (
    "day" DATE NOT NULL,
    "channel" "AgentApiChannel" NOT NULL,
    "tool" TEXT NOT NULL,
    "calls" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AgentApiDaily_pkey" PRIMARY KEY ("day","channel","tool")
);
