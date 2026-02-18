-- Add Setor (groupId) and Grupo (sectorId) to HelpdeskTipoSolicitacao
ALTER TABLE "HelpdeskTipoSolicitacao" ADD COLUMN IF NOT EXISTS "groupId" TEXT;
ALTER TABLE "HelpdeskTipoSolicitacao" ADD COLUMN IF NOT EXISTS "sectorId" TEXT;

CREATE INDEX IF NOT EXISTS "HelpdeskTipoSolicitacao_groupId_idx" ON "HelpdeskTipoSolicitacao"("groupId");
CREATE INDEX IF NOT EXISTS "HelpdeskTipoSolicitacao_sectorId_idx" ON "HelpdeskTipoSolicitacao"("sectorId");

ALTER TABLE "HelpdeskTipoSolicitacao" ADD CONSTRAINT "HelpdeskTipoSolicitacao_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HelpdeskTipoSolicitacao" ADD CONSTRAINT "HelpdeskTipoSolicitacao_sectorId_fkey"
  FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;
