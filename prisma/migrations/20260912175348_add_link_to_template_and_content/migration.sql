-- AlterTable
ALTER TABLE "AffiliateContent" ADD COLUMN     "linkId" TEXT;

-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "linkId" TEXT;

-- CreateIndex
CREATE INDEX "AffiliateContent_linkId_idx" ON "AffiliateContent"("linkId");

-- CreateIndex
CREATE INDEX "Template_linkId_idx" ON "Template"("linkId");

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "AffiliateLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateContent" ADD CONSTRAINT "AffiliateContent_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "AffiliateLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
