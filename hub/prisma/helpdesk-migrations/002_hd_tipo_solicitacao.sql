-- Tipo de solicitacao (categorias hierarquicas) + FK em ticket

CREATE TABLE IF NOT EXISTS hd_tipo_solicitacao (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  parent_id TEXT REFERENCES hd_tipo_solicitacao(id) ON DELETE SET NULL,
  status CHAR(1) NOT NULL DEFAULT 'A',
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hd_tipo_solicitacao_parent_id ON hd_tipo_solicitacao(parent_id);
CREATE INDEX IF NOT EXISTS idx_hd_tipo_solicitacao_status ON hd_tipo_solicitacao(status);
CREATE INDEX IF NOT EXISTS idx_hd_tipo_solicitacao_nome ON hd_tipo_solicitacao(nome);

ALTER TABLE hd_ticket ADD COLUMN IF NOT EXISTS tipo_solicitacao_id TEXT REFERENCES hd_tipo_solicitacao(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_hd_ticket_tipo_solicitacao_id ON hd_ticket(tipo_solicitacao_id);
