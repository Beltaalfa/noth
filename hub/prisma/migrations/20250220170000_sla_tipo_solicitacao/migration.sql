-- AlterTable
ALTER TABLE "HelpdeskTipoSolicitacao" ADD COLUMN IF NOT EXISTS "slaLimitHours" INTEGER,
ADD COLUMN IF NOT EXISTS "slaWarnHoursBefore" INTEGER;
