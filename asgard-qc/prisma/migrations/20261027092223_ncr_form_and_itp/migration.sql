-- CreateEnum
CREATE TYPE "NcrSeverity" AS ENUM ('MINOR', 'MAJOR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ImpactLevel" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "EffectivenessStatus" AS ENUM ('PENDING', 'EFFECTIVE', 'NOT_EFFECTIVE');

-- CreateEnum
CREATE TYPE "ControlPointType" AS ENUM ('H', 'W', 'I', 'R', 'M', 'S', 'A');

-- CreateEnum
CREATE TYPE "ControlPointStatus" AS ENUM ('OPEN', 'SIGNED', 'NOT_APPLICABLE');

-- AlterTable
ALTER TABLE "Ncr" ADD COLUMN     "contributingFactors" TEXT,
ADD COLUMN     "department" TEXT,
ADD COLUMN     "detectedBy" TEXT,
ADD COLUMN     "drawingRef" TEXT,
ADD COLUMN     "effectivenessAt" TIMESTAMP(3),
ADD COLUMN     "effectivenessById" TEXT,
ADD COLUMN     "effectivenessByName" TEXT,
ADD COLUMN     "effectivenessDueAt" TIMESTAMP(3),
ADD COLUMN     "effectivenessNotes" TEXT,
ADD COLUMN     "effectivenessStatus" "EffectivenessStatus",
ADD COLUMN     "impactCost" "ImpactLevel",
ADD COLUMN     "impactCustomer" "ImpactLevel",
ADD COLUMN     "impactNotes" TEXT,
ADD COLUMN     "impactQms" "ImpactLevel",
ADD COLUMN     "impactSafety" "ImpactLevel",
ADD COLUMN     "impactSchedule" "ImpactLevel",
ADD COLUMN     "impactStructural" "ImpactLevel",
ADD COLUMN     "severity" "NcrSeverity",
ADD COLUMN     "stageOfDetection" TEXT;

-- CreateTable
CREATE TABLE "ItpPlan" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "discipline" TEXT NOT NULL,
    "documentRef" TEXT,
    "sourceFile" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItpPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ControlPoint" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "itemNo" TEXT NOT NULL,
    "section" TEXT,
    "activity" TEXT NOT NULL,
    "acceptanceCriteria" TEXT,
    "method" TEXT,
    "frequency" TEXT,
    "extent" TEXT,
    "responsibility" TEXT,
    "signoffDocument" TEXT,
    "verifyingDocument" TEXT,
    "pointType" "ControlPointType",
    "subPoint" TEXT,
    "clientPoint" TEXT,
    "thirdPartyPoint" TEXT,
    "status" "ControlPointStatus" NOT NULL DEFAULT 'OPEN',
    "signedById" TEXT,
    "signedByName" TEXT,
    "signedAt" TIMESTAMP(3),
    "evidence" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ControlPoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ItpPlan_projectId_discipline_key" ON "ItpPlan"("projectId", "discipline");

-- CreateIndex
CREATE INDEX "ControlPoint_planId_status_idx" ON "ControlPoint"("planId", "status");

-- AddForeignKey
ALTER TABLE "ItpPlan" ADD CONSTRAINT "ItpPlan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlPoint" ADD CONSTRAINT "ControlPoint_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ItpPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
