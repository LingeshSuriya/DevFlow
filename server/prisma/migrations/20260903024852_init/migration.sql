/*
  Warnings:

  - A unique constraint covering the columns `[orgId,name]` on the table `Channel` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `orgId` to the `Channel` table without a default value. This is not possible if the table is not empty.
  - Added the required column `orgId` to the `Task` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Channel_name_key";

-- AlterTable
ALTER TABLE "Channel" ADD COLUMN     "orgId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "orgId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Channel_orgId_name_key" ON "Channel"("orgId", "name");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
