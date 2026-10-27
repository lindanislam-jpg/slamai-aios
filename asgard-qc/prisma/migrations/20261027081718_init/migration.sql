-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'QUALITY_MANAGER', 'QC_INSPECTOR', 'WELDING_INSPECTOR', 'MATERIAL_INSPECTOR', 'PRODUCTION_VIEWER', 'AUDITOR');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNED', 'ACTIVE', 'ON_HOLD', 'AWAITING_RELEASE', 'RELEASED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('MODULE', 'FRAME', 'COMPONENT');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING_REVIEW', 'REVIEWED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReworkPhase" AS ENUM ('BEFORE', 'AFTER');

-- CreateEnum
CREATE TYPE "InspectionType" AS ENUM ('INCOMING_MATERIAL', 'FABRICATION', 'DIMENSIONAL', 'WELD_VISUAL', 'NDT', 'COATING', 'INTERMEDIATE', 'FINAL', 'OTHER');

-- CreateEnum
CREATE TYPE "InspectionResult" AS ENUM ('PENDING', 'PASS', 'FAIL', 'HOLD', 'NA');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'REVIEWED', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CriteriaStatus" AS ENUM ('DEFINED', 'REQUIRES_CONFIGURATION');

-- CreateEnum
CREATE TYPE "WeldStatus" AS ENUM ('AWAITING_INSPECTION', 'ACCEPTED', 'REPAIR_REQUIRED', 'AWAITING_REINSPECTION', 'REJECTED');

-- CreateEnum
CREATE TYPE "DefectSource" AS ENUM ('INSPECTOR', 'AI_SUGGESTION');

-- CreateEnum
CREATE TYPE "CertStatus" AS ENUM ('MISSING', 'UPLOADED_UNVERIFIED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MaterialStatus" AS ENUM ('AWAITING_INSPECTION', 'ACCEPTED', 'REJECTED', 'QUARANTINED');

-- CreateEnum
CREATE TYPE "TestResult" AS ENUM ('PENDING', 'ACCEPT', 'REJECT');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "NcrStatus" AS ENUM ('OPEN', 'CONTAINED', 'INVESTIGATING', 'ACTION_IN_PROGRESS', 'AWAITING_VERIFICATION', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('CORRECTIVE', 'PREVENTIVE', 'CONTAINMENT');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FindingType" AS ENUM ('NONCONFORMITY', 'OBSERVATION', 'OPPORTUNITY');

-- CreateEnum
CREATE TYPE "FindingStatus" AS ENUM ('OPEN', 'ACTION_IN_PROGRESS', 'AWAITING_VERIFICATION', 'CLOSED');

-- CreateEnum
CREATE TYPE "DocStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'SUPERSEDED', 'OBSOLETE');

-- CreateEnum
CREATE TYPE "ReleaseStatus" AS ENUM ('RELEASED', 'RELEASED_WITH_CONCESSION', 'REVOKED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PRODUCTION_VIEWER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notificationPrefs" JSONB,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,
    "actorName" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "summary" TEXT,
    "before" JSONB,
    "after" JSONB,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sequence" (
    "name" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Sequence_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customerRef" TEXT,
    "description" TEXT,
    "scope" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNED',
    "startDate" TIMESTAMP(3),
    "targetDate" TIMESTAMP(3),
    "projectManager" TEXT,
    "departments" TEXT,
    "drawingRefs" TEXT,
    "requirements" TEXT,
    "stages" TEXT[],
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "type" "UnitType" NOT NULL DEFAULT 'FRAME',
    "parentId" TEXT,
    "description" TEXT,
    "drawingRef" TEXT,
    "revision" TEXT,
    "stage" TEXT,
    "released" BOOLEAN NOT NULL DEFAULT false,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "unitId" TEXT,
    "componentRef" TEXT,
    "stage" TEXT,
    "category" TEXT NOT NULL,
    "inspectionType" TEXT,
    "takenAt" TIMESTAMP(3),
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" TEXT,
    "uploadedByName" TEXT,
    "responsiblePerson" TEXT,
    "heatNumber" TEXT,
    "weldRef" TEXT,
    "inspectionId" TEXT,
    "ncrId" TEXT,
    "weldId" TEXT,
    "materialId" TEXT,
    "repairId" TEXT,
    "reworkPhase" "ReworkPhase",
    "caption" TEXT,
    "description" TEXT,
    "observedCondition" TEXT,
    "correctiveAction" TEXT,
    "tags" TEXT[],
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "storageKey" TEXT NOT NULL,
    "thumbKey" TEXT,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "sha256" TEXT NOT NULL,
    "aiSuggestion" JSONB,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "unitId" TEXT,
    "type" "InspectionType" NOT NULL,
    "operation" TEXT,
    "stage" TEXT,
    "componentRef" TEXT,
    "drawingRef" TEXT,
    "plannedDate" TIMESTAMP(3),
    "inspectedAt" TIMESTAMP(3),
    "inspectorId" TEXT,
    "inspectorName" TEXT,
    "criteriaRef" TEXT,
    "result" "InspectionResult" NOT NULL DEFAULT 'PENDING',
    "status" "RecordStatus" NOT NULL DEFAULT 'DRAFT',
    "comments" TEXT,
    "reinspectionOfId" TEXT,
    "reviewerId" TEXT,
    "reviewerName" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "requirement" TEXT,
    "criteriaStatus" "CriteriaStatus" NOT NULL DEFAULT 'REQUIRES_CONFIGURATION',
    "tolerance" TEXT,
    "actual" TEXT,
    "unit" TEXT,
    "result" "InspectionResult" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inspectionType" "InspectionType" NOT NULL,
    "items" JSONB NOT NULL,
    "documentRef" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Weld" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "unitId" TEXT,
    "weldRef" TEXT NOT NULL,
    "componentRef" TEXT,
    "drawingRef" TEXT,
    "wpsRef" TEXT,
    "welderId" TEXT,
    "welderQualRef" TEXT,
    "process" TEXT,
    "materialDetails" TEXT,
    "stage" TEXT,
    "inspectedAt" TIMESTAMP(3),
    "inspectorName" TEXT,
    "visualResult" "InspectionResult" NOT NULL DEFAULT 'PENDING',
    "criteriaRef" TEXT,
    "ndtRequired" BOOLEAN NOT NULL DEFAULT false,
    "status" "WeldStatus" NOT NULL DEFAULT 'AWAITING_INSPECTION',
    "notes" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Weld_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeldDefect" (
    "id" TEXT NOT NULL,
    "weldId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "source" "DefectSource" NOT NULL DEFAULT 'INSPECTOR',
    "notes" TEXT,
    "recordedById" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "WeldDefect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "projectId" TEXT,
    "componentRef" TEXT,
    "description" TEXT NOT NULL,
    "grade" TEXT,
    "supplier" TEXT,
    "poRef" TEXT,
    "deliveryRef" TEXT,
    "heatNumber" TEXT,
    "certificateRef" TEXT,
    "certificateDocId" TEXT,
    "certStatus" "CertStatus" NOT NULL DEFAULT 'MISSING',
    "quantity" DECIMAL(65,30),
    "unit" TEXT,
    "receivingResult" "InspectionResult" NOT NULL DEFAULT 'PENDING',
    "location" TEXT,
    "status" "MaterialStatus" NOT NULL DEFAULT 'AWAITING_INSPECTION',
    "identificationMismatch" BOOLEAN NOT NULL DEFAULT false,
    "inspectorName" TEXT,
    "inspectedAt" TIMESTAMP(3),
    "dispositionById" TEXT,
    "dispositionAt" TIMESTAMP(3),
    "dispositionNotes" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NdtRecord" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "unitId" TEXT,
    "weldId" TEXT,
    "method" TEXT NOT NULL,
    "procedureRef" TEXT,
    "componentRef" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "reportNo" TEXT,
    "reportDate" TIMESTAMP(3),
    "contractor" TEXT,
    "personnelRef" TEXT,
    "result" "TestResult" NOT NULL DEFAULT 'PENDING',
    "reportDocId" TEXT,
    "followUp" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NdtRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoatingRecord" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "unitId" TEXT,
    "surfacePrep" TEXT,
    "product" TEXT,
    "batchRef" TEXT,
    "envReadings" TEXT,
    "dftReadings" TEXT,
    "specRef" TEXT,
    "result" "InspectionResult" NOT NULL DEFAULT 'PENDING',
    "inspectorName" TEXT,
    "inspectedAt" TIMESTAMP(3),
    "notes" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoatingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ncr" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "unitId" TEXT,
    "componentRef" TEXT,
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raisedById" TEXT,
    "raisedByName" TEXT,
    "description" TEXT NOT NULL,
    "defectCategory" TEXT NOT NULL,
    "requirementRef" TEXT,
    "containment" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "rootCauseCategory" TEXT,
    "rootCauseMethod" TEXT,
    "rootCause" TEXT,
    "disposition" TEXT,
    "repairMethod" TEXT,
    "ownerName" TEXT,
    "targetDate" TIMESTAMP(3),
    "status" "NcrStatus" NOT NULL DEFAULT 'OPEN',
    "verificationNotes" TEXT,
    "reinspectionResult" "InspectionResult",
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "closedByName" TEXT,
    "closedAt" TIMESTAMP(3),
    "inspectionId" TEXT,
    "weldId" TEXT,
    "materialId" TEXT,
    "relatedCodes" TEXT[],
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ncr_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorrectiveAction" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "ncrId" TEXT,
    "auditFindingId" TEXT,
    "type" "ActionType" NOT NULL DEFAULT 'CORRECTIVE',
    "description" TEXT NOT NULL,
    "ownerName" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "ActionStatus" NOT NULL DEFAULT 'OPEN',
    "completedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "notes" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CorrectiveAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repair" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "unitId" TEXT,
    "ncrId" TEXT,
    "weldId" TEXT,
    "description" TEXT NOT NULL,
    "method" TEXT,
    "performedBy" TEXT,
    "performedAt" TIMESTAMP(3),
    "hours" DECIMAL(65,30),
    "cost" DECIMAL(65,30),
    "costIsEstimate" BOOLEAN NOT NULL DEFAULT false,
    "reinspectionResult" "InspectionResult" NOT NULL DEFAULT 'PENDING',
    "reinspectedBy" TEXT,
    "reinspectedAt" TIMESTAMP(3),
    "notes" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Repair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityAudit" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "auditType" TEXT NOT NULL,
    "scope" TEXT,
    "standardRefs" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "auditor" TEXT,
    "status" "AuditStatus" NOT NULL DEFAULT 'PLANNED',
    "checklist" JSONB,
    "summary" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualityAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditFinding" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "type" "FindingType" NOT NULL,
    "description" TEXT NOT NULL,
    "clauseRef" TEXT,
    "evidence" TEXT,
    "ownerName" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "FindingStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "docNo" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "projectId" TEXT,
    "ownerName" TEXT,
    "status" "DocStatus" NOT NULL DEFAULT 'DRAFT',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentRevision" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "revision" TEXT NOT NULL,
    "storageKey" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "sha256" TEXT,
    "notes" TEXT,
    "status" "DocStatus" NOT NULL DEFAULT 'UNDER_REVIEW',
    "uploadedById" TEXT,
    "uploadedByName" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" TEXT,
    "approvedByName" TEXT,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "DocumentRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "assetNo" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "serialNo" TEXT,
    "location" TEXT,
    "intervalDays" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalibrationRecord" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "calibratedAt" TIMESTAMP(3) NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "certificateRef" TEXT,
    "provider" TEXT,
    "result" TEXT,
    "documentId" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalibrationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleaseRecord" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "unitId" TEXT,
    "status" "ReleaseStatus" NOT NULL,
    "checks" JSONB NOT NULL,
    "concessionRef" TEXT,
    "concessionReason" TEXT,
    "releasedById" TEXT NOT NULL,
    "releasedByName" TEXT NOT NULL,
    "releasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "revokedById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ReleaseRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportJob" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "storageKey" TEXT,
    "sizeBytes" INTEGER,
    "error" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ReportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "LoginAttempt_email_createdAt_idx" ON "LoginAttempt"("email", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditEvent_at_idx" ON "AuditEvent"("at");

-- CreateIndex
CREATE UNIQUE INDEX "Project_code_key" ON "Project"("code");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_projectId_ref_key" ON "Unit"("projectId", "ref");

-- CreateIndex
CREATE UNIQUE INDEX "Photo_code_key" ON "Photo"("code");

-- CreateIndex
CREATE INDEX "Photo_projectId_category_idx" ON "Photo"("projectId", "category");

-- CreateIndex
CREATE INDEX "Photo_unitId_idx" ON "Photo"("unitId");

-- CreateIndex
CREATE INDEX "Photo_sha256_idx" ON "Photo"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "Inspection_code_key" ON "Inspection"("code");

-- CreateIndex
CREATE INDEX "Inspection_projectId_type_idx" ON "Inspection"("projectId", "type");

-- CreateIndex
CREATE INDEX "Inspection_inspectedAt_idx" ON "Inspection"("inspectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Weld_projectId_weldRef_key" ON "Weld"("projectId", "weldRef");

-- CreateIndex
CREATE UNIQUE INDEX "Material_code_key" ON "Material"("code");

-- CreateIndex
CREATE INDEX "Material_heatNumber_idx" ON "Material"("heatNumber");

-- CreateIndex
CREATE INDEX "Material_grade_idx" ON "Material"("grade");

-- CreateIndex
CREATE UNIQUE INDEX "NdtRecord_code_key" ON "NdtRecord"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CoatingRecord_code_key" ON "CoatingRecord"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Ncr_code_key" ON "Ncr"("code");

-- CreateIndex
CREATE INDEX "Ncr_projectId_status_idx" ON "Ncr"("projectId", "status");

-- CreateIndex
CREATE INDEX "Ncr_defectCategory_idx" ON "Ncr"("defectCategory");

-- CreateIndex
CREATE UNIQUE INDEX "CorrectiveAction_code_key" ON "CorrectiveAction"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Repair_code_key" ON "Repair"("code");

-- CreateIndex
CREATE UNIQUE INDEX "QualityAudit_code_key" ON "QualityAudit"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AuditFinding_code_key" ON "AuditFinding"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Document_docNo_key" ON "Document"("docNo");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentRevision_documentId_revision_key" ON "DocumentRevision"("documentId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_assetNo_key" ON "Equipment"("assetNo");

-- CreateIndex
CREATE UNIQUE INDEX "ReleaseRecord_code_key" ON "ReleaseRecord"("code");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_userId_dedupeKey_key" ON "Notification"("userId", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "ReportJob_code_key" ON "ReportJob"("code");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_ncrId_fkey" FOREIGN KEY ("ncrId") REFERENCES "Ncr"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_weldId_fkey" FOREIGN KEY ("weldId") REFERENCES "Weld"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_repairId_fkey" FOREIGN KEY ("repairId") REFERENCES "Repair"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_reinspectionOfId_fkey" FOREIGN KEY ("reinspectionOfId") REFERENCES "Inspection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Weld" ADD CONSTRAINT "Weld_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Weld" ADD CONSTRAINT "Weld_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeldDefect" ADD CONSTRAINT "WeldDefect_weldId_fkey" FOREIGN KEY ("weldId") REFERENCES "Weld"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NdtRecord" ADD CONSTRAINT "NdtRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NdtRecord" ADD CONSTRAINT "NdtRecord_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NdtRecord" ADD CONSTRAINT "NdtRecord_weldId_fkey" FOREIGN KEY ("weldId") REFERENCES "Weld"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoatingRecord" ADD CONSTRAINT "CoatingRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoatingRecord" ADD CONSTRAINT "CoatingRecord_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ncr" ADD CONSTRAINT "Ncr_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ncr" ADD CONSTRAINT "Ncr_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ncr" ADD CONSTRAINT "Ncr_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ncr" ADD CONSTRAINT "Ncr_weldId_fkey" FOREIGN KEY ("weldId") REFERENCES "Weld"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ncr" ADD CONSTRAINT "Ncr_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectiveAction" ADD CONSTRAINT "CorrectiveAction_ncrId_fkey" FOREIGN KEY ("ncrId") REFERENCES "Ncr"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectiveAction" ADD CONSTRAINT "CorrectiveAction_auditFindingId_fkey" FOREIGN KEY ("auditFindingId") REFERENCES "AuditFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repair" ADD CONSTRAINT "Repair_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repair" ADD CONSTRAINT "Repair_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repair" ADD CONSTRAINT "Repair_ncrId_fkey" FOREIGN KEY ("ncrId") REFERENCES "Ncr"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repair" ADD CONSTRAINT "Repair_weldId_fkey" FOREIGN KEY ("weldId") REFERENCES "Weld"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditFinding" ADD CONSTRAINT "AuditFinding_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "QualityAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRevision" ADD CONSTRAINT "DocumentRevision_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationRecord" ADD CONSTRAINT "CalibrationRecord_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseRecord" ADD CONSTRAINT "ReleaseRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseRecord" ADD CONSTRAINT "ReleaseRecord_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportJob" ADD CONSTRAINT "ReportJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
