-- AlterTable
ALTER TABLE "ProjectFile" ADD COLUMN     "qualityPackId" TEXT;

-- CreateIndex
CREATE INDEX "ProjectFile_qualityPackId_idx" ON "ProjectFile"("qualityPackId");

-- AddForeignKey
ALTER TABLE "ProjectFile" ADD CONSTRAINT "ProjectFile_qualityPackId_fkey" FOREIGN KEY ("qualityPackId") REFERENCES "QualityPack"("id") ON DELETE SET NULL ON UPDATE CASCADE;
