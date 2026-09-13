-- Template bisa punya banyak link berurutan ({{affiliate_link_N}}).
-- Urutan penting: tabel baru dibuat dan diisi DULU dari Template.linkId,
-- baru kolom lama dihapus, supaya tidak ada link template yang hilang.

CREATE TABLE "TemplateLink" (
    "templateId" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "TemplateLink_pkey" PRIMARY KEY ("templateId","position")
);

CREATE UNIQUE INDEX "TemplateLink_templateId_linkId_key" ON "TemplateLink"("templateId", "linkId");
CREATE INDEX "TemplateLink_linkId_idx" ON "TemplateLink"("linkId");

ALTER TABLE "TemplateLink" ADD CONSTRAINT "TemplateLink_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TemplateLink" ADD CONSTRAINT "TemplateLink_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "AffiliateLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Link tunggal lama menjadi link nomor 1.
INSERT INTO "TemplateLink" ("templateId", "linkId", "position")
SELECT "id", "linkId", 1 FROM "Template" WHERE "linkId" IS NOT NULL;

ALTER TABLE "Template" DROP CONSTRAINT "Template_linkId_fkey";
DROP INDEX "Template_linkId_idx";
ALTER TABLE "Template" DROP COLUMN "linkId";
