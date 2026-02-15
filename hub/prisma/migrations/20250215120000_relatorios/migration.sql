-- AlterTable
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;

-- AlterEnum (PostgreSQL: add new value to existing enum)
ALTER TYPE "ToolType" ADD VALUE 'powerbi_report';

-- AlterTable
ALTER TABLE "Tool" ADD COLUMN IF NOT EXISTS "powerbiUrl" TEXT;

-- CreateEnum
CREATE TYPE "PrincipalType" AS ENUM ('user', 'group', 'sector');

-- CreateTable
CREATE TABLE IF NOT EXISTS "ToolPermission" (
    "id" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "principalType" "PrincipalType" NOT NULL,
    "principalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ToolPermission_toolId_principalType_principalId_key" ON "ToolPermission"("toolId", "principalType", "principalId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ToolPermission_toolId_idx" ON "ToolPermission"("toolId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ToolPermission_principalType_principalId_idx" ON "ToolPermission"("principalType", "principalId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ToolPermission_toolId_fkey'
  ) THEN
    ALTER TABLE "ToolPermission" ADD CONSTRAINT "ToolPermission_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
