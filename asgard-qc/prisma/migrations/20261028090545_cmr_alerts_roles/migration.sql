-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('IN_SERVICE', 'RESTRICTED', 'OUT_OF_SERVICE', 'RETIRED');

-- CreateEnum
CREATE TYPE "CmrStatus" AS ENUM ('SUBMITTED', 'ACKNOWLEDGED', 'ASSIGNED', 'IN_PROGRESS', 'AWAITING_PARTS', 'AWAITING_EXTERNAL', 'AWAITING_VERIFICATION', 'COMPLETED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('NEW', 'ACKNOWLEDGED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'PRODUCTION_SUPERVISOR';
ALTER TYPE "Role" ADD VALUE 'MAINTENANCE_TECHNICIAN';
ALTER TYPE "Role" ADD VALUE 'PROJECT_MANAGER';

-- AlterTable
ALTER TABLE "Equipment" ADD COLUMN     "equipmentType" TEXT,
ADD COLUMN     "ownerName" TEXT,
ADD COLUMN     "status" "EquipmentStatus" NOT NULL DEFAULT 'IN_SERVICE',
ADD COLUMN     "statusNote" TEXT;

-- CreateTable
CREATE TABLE "Cmr" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "equipmentId" TEXT,
    "assetLabel" TEXT,
    "location" TEXT,
    "projectId" TEXT,
    "productionArea" TEXT,
    "problem" TEXT NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reportedById" TEXT,
    "reportedByName" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "safetyImpact" BOOLEAN NOT NULL DEFAULT false,
    "productionImpact" TEXT,
    "equipmentUnavailable" BOOLEAN NOT NULL DEFAULT false,
    "requestedBy" TIMESTAMP(3),
    "status" "CmrStatus" NOT NULL DEFAULT 'SUBMITTED',
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedByName" TEXT,
    "assignedToName" TEXT,
    "assignedAt" TIMESTAMP(3),
    "diagnosis" TEXT,
    "workDone" TEXT,
    "partsUsed" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "downtimeHours" DECIMAL(65,30),
    "outstandingIssues" TEXT,
    "verifiedById" TEXT,
    "verifiedByName" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verificationNote" TEXT,
    "closedAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "reopenCount" INTEGER NOT NULL DEFAULT 0,
    "closureHistory" JSONB,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cmr_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmrAttachment" (
    "id" TEXT NOT NULL,
    "cmrId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "caption" TEXT,
    "uploadedById" TEXT,
    "uploadedByName" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CmrAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "params" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedByName" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityAlert" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "ruleKey" TEXT NOT NULL,
    "ruleVersion" INTEGER NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "evidence" JSONB,
    "href" TEXT,
    "projectId" TEXT,
    "status" "AlertStatus" NOT NULL DEFAULT 'NEW',
    "assignedToName" TEXT,
    "acknowledgedByName" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedByName" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "dismissedReason" TEXT,
    "firstRaisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conditionClearedAt" TIMESTAMP(3),
    "reopenCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualityAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cmr_code_key" ON "Cmr"("code");

-- CreateIndex
CREATE INDEX "Cmr_status_idx" ON "Cmr"("status");

-- CreateIndex
CREATE INDEX "Cmr_equipmentId_reportedAt_idx" ON "Cmr"("equipmentId", "reportedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CmrAttachment_storageKey_key" ON "CmrAttachment"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "AlertRule_key_key" ON "AlertRule"("key");

-- CreateIndex
CREATE UNIQUE INDEX "QualityAlert_code_key" ON "QualityAlert"("code");

-- CreateIndex
CREATE UNIQUE INDEX "QualityAlert_dedupeKey_key" ON "QualityAlert"("dedupeKey");

-- CreateIndex
CREATE INDEX "QualityAlert_status_severity_idx" ON "QualityAlert"("status", "severity");

-- CreateIndex
CREATE INDEX "QualityAlert_projectId_idx" ON "QualityAlert"("projectId");

-- AddForeignKey
ALTER TABLE "Cmr" ADD CONSTRAINT "Cmr_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cmr" ADD CONSTRAINT "Cmr_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CmrAttachment" ADD CONSTRAINT "CmrAttachment_cmrId_fkey" FOREIGN KEY ("cmrId") REFERENCES "Cmr"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityAlert" ADD CONSTRAINT "QualityAlert_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
