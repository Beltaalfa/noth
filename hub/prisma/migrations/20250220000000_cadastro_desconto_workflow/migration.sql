-- AlterEnum: add aguardando_aprovacao_proprietarios to HelpdeskTicketStatus
ALTER TYPE "HelpdeskTicketStatus" ADD VALUE IF NOT EXISTS 'aguardando_aprovacao_proprietarios';

-- AlterTable HelpdeskTicket: formData (JSONB), workflowStep
ALTER TABLE "HelpdeskTicket" ADD COLUMN IF NOT EXISTS "formData" JSONB;
ALTER TABLE "HelpdeskTicket" ADD COLUMN IF NOT EXISTS "workflowStep" TEXT;

-- CreateTable ClientProprietario
CREATE TABLE IF NOT EXISTS "ClientProprietario" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientProprietario_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClientProprietario_clientId_userId_key" ON "ClientProprietario"("clientId", "userId");
CREATE INDEX IF NOT EXISTS "ClientProprietario_clientId_idx" ON "ClientProprietario"("clientId");
CREATE INDEX IF NOT EXISTS "ClientProprietario_userId_idx" ON "ClientProprietario"("userId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClientProprietario_clientId_fkey') THEN
    ALTER TABLE "ClientProprietario" ADD CONSTRAINT "ClientProprietario_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClientProprietario_userId_fkey') THEN
    ALTER TABLE "ClientProprietario" ADD CONSTRAINT "ClientProprietario_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
