-- Multi-user: setiap template, link, topik, dan draft wajib punya pemilik.
-- Urutan penting: kolom baru diisi (backfill) DULU sebelum dijadikan NOT NULL,
-- karena tabel sudah berisi data dari masa single-user.

-- DropForeignKey
ALTER TABLE "AffiliateContent" DROP CONSTRAINT "AffiliateContent_userId_fkey";
ALTER TABLE "AffiliateLink" DROP CONSTRAINT "AffiliateLink_userId_fkey";
ALTER TABLE "Template" DROP CONSTRAINT "Template_userId_fkey";
ALTER TABLE "Topic" DROP CONSTRAINT "Topic_userId_fkey";

-- Nama kini unik per user, bukan global
DROP INDEX "AffiliateLink_name_key";
DROP INDEX "Template_name_key";

-- User: username wajib -> tambah nullable, isi dari email, baru wajibkan
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" TIMESTAMP(3),
ADD COLUMN "threadsUsername" TEXT,
ADD COLUMN "username" TEXT;

UPDATE "User" SET "username" = lower(split_part("email", '@', 1)) WHERE "username" IS NULL;
-- Tabrakan (dua email dengan bagian lokal sama): beri akhiran id pendek
UPDATE "User" u SET "username" = u."username" || '_' || substr(u."id", 1, 6)
WHERE EXISTS (
  SELECT 1 FROM "User" o WHERE o."username" = u."username" AND o."id" < u."id"
);
ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;

-- Pertahankan perilaku auto-publish yang sudah jalan untuk akun admin
UPDATE "User" SET "threadsUsername" = 'muhammadrizky522'
WHERE "email" = 'admin@threads.local' AND "threadsUsername" IS NULL;

-- Data lama (masa single-user) diserahkan ke user tertua = admin
UPDATE "Topic" SET "userId" = (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1) WHERE "userId" IS NULL;
UPDATE "Template" SET "userId" = (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1) WHERE "userId" IS NULL;
UPDATE "AffiliateLink" SET "userId" = (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1) WHERE "userId" IS NULL;
UPDATE "AffiliateContent" SET "userId" = (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1) WHERE "userId" IS NULL;

-- AlterTable
ALTER TABLE "AffiliateContent" ADD COLUMN "replyLink" TEXT,
ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "AffiliateLink" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Template" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Topic" ALTER COLUMN "userId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateLink_userId_name_key" ON "AffiliateLink"("userId", "name");
CREATE UNIQUE INDEX "Template_userId_name_key" ON "Template"("userId", "name");
CREATE INDEX "Topic_userId_keyword_idx" ON "Topic"("userId", "keyword");
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Template" ADD CONSTRAINT "Template_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AffiliateLink" ADD CONSTRAINT "AffiliateLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AffiliateContent" ADD CONSTRAINT "AffiliateContent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
