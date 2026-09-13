-- Kategori opsional pada link produk; tambahan murni, data lama tidak berubah.
ALTER TABLE "AffiliateLink" ADD COLUMN "categoryId" TEXT;
CREATE INDEX "AffiliateLink_categoryId_idx" ON "AffiliateLink"("categoryId");
ALTER TABLE "AffiliateLink" ADD CONSTRAINT "AffiliateLink_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
