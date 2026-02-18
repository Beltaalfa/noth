-- Aprovação por Grupo (Sector): restringir a um tipo de solicitação
ALTER TABLE "HelpdeskApprovalConfig" ADD COLUMN IF NOT EXISTS "tipoSolicitacaoId" TEXT;

CREATE INDEX IF NOT EXISTS "HelpdeskApprovalConfig_tipoSolicitacaoId_idx" ON "HelpdeskApprovalConfig"("tipoSolicitacaoId");

ALTER TABLE "HelpdeskApprovalConfig" ADD CONSTRAINT "HelpdeskApprovalConfig_tipoSolicitacaoId_fkey"
  FOREIGN KEY ("tipoSolicitacaoId") REFERENCES "HelpdeskTipoSolicitacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
