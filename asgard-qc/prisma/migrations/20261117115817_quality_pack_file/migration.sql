-- AlterTable
ALTER TABLE "QualityPack" ADD COLUMN     "projectFileId" TEXT;

-- AddForeignKey
ALTER TABLE "QualityPack" ADD CONSTRAINT "QualityPack_projectFileId_fkey" FOREIGN KEY ("projectFileId") REFERENCES "ProjectFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
