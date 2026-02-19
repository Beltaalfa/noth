-- CreateEnum for HelpdeskTicketPriority
CREATE TYPE "HelpdeskTicketPriority" AS ENUM ('baixa', 'media', 'alta', 'critica');

-- CreateEnum for HelpdeskNivelAcesso
CREATE TYPE "HelpdeskNivelAcesso" AS ENUM ('solicitante', 'operador', 'gestor', 'admin');

-- Add new values to HelpdeskTicketStatus
ALTER TYPE "HelpdeskTicketStatus" ADD VALUE IF NOT EXISTS 'agendado_com_usuario';
ALTER TYPE "HelpdeskTicketStatus" ADD VALUE IF NOT EXISTS 'aguardando_atendimento';
ALTER TYPE "HelpdeskTicketStatus" ADD VALUE IF NOT EXISTS 'em_atendimento';
ALTER TYPE "HelpdeskTicketStatus" ADD VALUE IF NOT EXISTS 'aguardando_feedback_usuario';
ALTER TYPE "HelpdeskTicketStatus" ADD VALUE IF NOT EXISTS 'encaminhado_operador';
ALTER TYPE "HelpdeskTicketStatus" ADD VALUE IF NOT EXISTS 'indisponivel_atendimento';
ALTER TYPE "HelpdeskTicketStatus" ADD VALUE IF NOT EXISTS 'reaberto';
ALTER TYPE "HelpdeskTicketStatus" ADD VALUE IF NOT EXISTS 'retornado_usuario';
ALTER TYPE "HelpdeskTicketStatus" ADD VALUE IF NOT EXISTS 'custo_aguardando_aprovacao';
ALTER TYPE "HelpdeskTicketStatus" ADD VALUE IF NOT EXISTS 'autorizado';
ALTER TYPE "HelpdeskTicketStatus" ADD VALUE IF NOT EXISTS 'negado';
ALTER TYPE "HelpdeskTicketStatus" ADD VALUE IF NOT EXISTS 'atualizado';
ALTER TYPE "HelpdeskTicketStatus" ADD VALUE IF NOT EXISTS 'concluido';

-- User: helpdesk profile fields
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "helpdeskNivelAcesso" "HelpdeskNivelAcesso" DEFAULT 'solicitante';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "primaryGroupId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "primarySectorId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isGerenteArea" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "podeReceberChamados" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "podeEncaminharChamados" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "valorMaximoAutorizar" DECIMAL(15,2);

CREATE INDEX IF NOT EXISTS "User_primaryGroupId_idx" ON "User"("primaryGroupId");
CREATE INDEX IF NOT EXISTS "User_primarySectorId_idx" ON "User"("primarySectorId");
CREATE INDEX IF NOT EXISTS "User_isGerenteArea_idx" ON "User"("isGerenteArea");
CREATE INDEX IF NOT EXISTS "User_podeReceberChamados_idx" ON "User"("podeReceberChamados");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_primaryGroupId_fkey') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_primaryGroupId_fkey" FOREIGN KEY ("primaryGroupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_primarySectorId_fkey') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_primarySectorId_fkey" FOREIGN KEY ("primarySectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- HelpdeskTicket: priority, scheduledAt, custoOrcamento
ALTER TABLE "HelpdeskTicket" ADD COLUMN IF NOT EXISTS "priority" "HelpdeskTicketPriority";
ALTER TABLE "HelpdeskTicket" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);
ALTER TABLE "HelpdeskTicket" ADD COLUMN IF NOT EXISTS "custoOrcamento" DECIMAL(15,2);

CREATE INDEX IF NOT EXISTS "HelpdeskTicket_priority_idx" ON "HelpdeskTicket"("priority");

-- HelpdeskTicketAuxAssignee
CREATE TABLE IF NOT EXISTS "HelpdeskTicketAuxAssignee" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HelpdeskTicketAuxAssignee_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HelpdeskTicketAuxAssignee_ticketId_userId_key" ON "HelpdeskTicketAuxAssignee"("ticketId", "userId");
CREATE INDEX IF NOT EXISTS "HelpdeskTicketAuxAssignee_ticketId_idx" ON "HelpdeskTicketAuxAssignee"("ticketId");
CREATE INDEX IF NOT EXISTS "HelpdeskTicketAuxAssignee_userId_idx" ON "HelpdeskTicketAuxAssignee"("userId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HelpdeskTicketAuxAssignee_ticketId_fkey') THEN
    ALTER TABLE "HelpdeskTicketAuxAssignee" ADD CONSTRAINT "HelpdeskTicketAuxAssignee_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "HelpdeskTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HelpdeskTicketAuxAssignee_userId_fkey') THEN
    ALTER TABLE "HelpdeskTicketAuxAssignee" ADD CONSTRAINT "HelpdeskTicketAuxAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
