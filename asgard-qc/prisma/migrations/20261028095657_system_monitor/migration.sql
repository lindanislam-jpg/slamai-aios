-- CreateEnum
CREATE TYPE "SystemRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED', 'MISSED');

-- CreateTable
CREATE TABLE "SystemCheckRun" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "runKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "slotDate" TEXT,
    "slotTime" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "status" "SystemRunStatus" NOT NULL DEFAULT 'RUNNING',
    "health" TEXT,
    "qualityStatus" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "triggeredBy" TEXT NOT NULL,
    "retryOfId" TEXT,
    "passed" INTEGER NOT NULL DEFAULT 0,
    "warnings" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "notRun" INTEGER NOT NULL DEFAULT 0,
    "checks" JSONB,
    "summary" JSONB,
    "changes" JSONB,
    "actions" JSONB,
    "notifications" JSONB,
    "error" TEXT,

    CONSTRAINT "SystemCheckRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SystemCheckRun_code_key" ON "SystemCheckRun"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SystemCheckRun_runKey_key" ON "SystemCheckRun"("runKey");

-- CreateIndex
CREATE INDEX "SystemCheckRun_startedAt_idx" ON "SystemCheckRun"("startedAt");

-- CreateIndex
CREATE INDEX "SystemCheckRun_status_idx" ON "SystemCheckRun"("status");
