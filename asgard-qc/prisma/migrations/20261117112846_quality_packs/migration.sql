-- CreateEnum
CREATE TYPE "PackStage" AS ENUM ('ISSUED', 'RETURNED');

-- CreateTable
CREATE TABLE "QualityPack" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "discipline" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stage" "PackStage" NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'file',
    "fileCount" INTEGER,
    "files" TEXT[],
    "sourcePath" TEXT,
    "sourceUrl" TEXT,
    "issuedAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "returnedByName" TEXT,
    "notes" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualityPack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QualityPack_code_key" ON "QualityPack"("code");

-- CreateIndex
CREATE INDEX "QualityPack_stage_projectId_idx" ON "QualityPack"("stage", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "QualityPack_projectId_sourcePath_key" ON "QualityPack"("projectId", "sourcePath");

-- AddForeignKey
ALTER TABLE "QualityPack" ADD CONSTRAINT "QualityPack_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
