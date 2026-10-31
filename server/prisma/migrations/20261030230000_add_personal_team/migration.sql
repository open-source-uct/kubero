-- AlterTable
ALTER TABLE "UserGroup" ADD COLUMN "ownerId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "UserGroup_ownerId_key" ON "UserGroup"("ownerId");

