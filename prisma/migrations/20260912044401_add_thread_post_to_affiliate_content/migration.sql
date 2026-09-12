-- AlterTable
ALTER TABLE "AffiliateContent" ADD COLUMN     "threadPostId" TEXT;

-- CreateIndex
CREATE INDEX "AffiliateContent_threadPostId_idx" ON "AffiliateContent"("threadPostId");

-- AddForeignKey
ALTER TABLE "AffiliateContent" ADD CONSTRAINT "AffiliateContent_threadPostId_fkey" FOREIGN KEY ("threadPostId") REFERENCES "ThreadPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;
