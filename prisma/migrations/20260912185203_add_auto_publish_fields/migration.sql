-- AlterTable
ALTER TABLE "AffiliateContent" ADD COLUMN     "autoPublishedAt" TIMESTAMP(3),
ADD COLUMN     "postUrl" TEXT,
ADD COLUMN     "publishedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "AffiliateContent_status_createdAt_idx" ON "AffiliateContent"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AffiliateContent_userId_status_createdAt_idx" ON "AffiliateContent"("userId", "status", "createdAt");
