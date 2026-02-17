-- Helpdesk tenant schema: tables with IDs only (no FK to central User/Group/Sector)
-- Table names use hd_ prefix.

CREATE TABLE IF NOT EXISTS helpdesk_schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE hd_ticket_status AS ENUM (
  'open', 'in_progress', 'closed', 'pending_approval', 'in_approval', 'rejected', 'approved', 'cancelled'
);
CREATE TYPE hd_assignee_type AS ENUM ('user', 'group', 'sector');
CREATE TYPE hd_approval_type AS ENUM ('hierarchical', 'by_level');
CREATE TYPE hd_approval_action AS ENUM ('approved', 'rejected');

CREATE TABLE IF NOT EXISTS hd_ticket (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  subject TEXT,
  status hd_ticket_status NOT NULL DEFAULT 'open',
  assignee_type hd_assignee_type NOT NULL,
  assignee_user_id TEXT,
  assignee_group_id TEXT,
  assignee_sector_id TEXT,
  created_by_id TEXT NOT NULL,
  sla_limit_hours INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hd_ticket_client_id ON hd_ticket(client_id);
CREATE INDEX IF NOT EXISTS idx_hd_ticket_created_by_id ON hd_ticket(created_by_id);
CREATE INDEX IF NOT EXISTS idx_hd_ticket_assignee_user_id ON hd_ticket(assignee_user_id);
CREATE INDEX IF NOT EXISTS idx_hd_ticket_assignee_group_id ON hd_ticket(assignee_group_id);
CREATE INDEX IF NOT EXISTS idx_hd_ticket_assignee_sector_id ON hd_ticket(assignee_sector_id);
CREATE INDEX IF NOT EXISTS idx_hd_ticket_status ON hd_ticket(status);
CREATE INDEX IF NOT EXISTS idx_hd_ticket_created_at ON hd_ticket(created_at);

CREATE TABLE IF NOT EXISTS hd_message (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES hd_ticket(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  forwarded_from_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hd_message_ticket_id ON hd_message(ticket_id);
CREATE INDEX IF NOT EXISTS idx_hd_message_user_id ON hd_message(user_id);
CREATE INDEX IF NOT EXISTS idx_hd_message_created_at ON hd_message(created_at);

CREATE TABLE IF NOT EXISTS hd_attachment (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES hd_message(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hd_attachment_message_id ON hd_attachment(message_id);

CREATE TABLE IF NOT EXISTS hd_notification (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  ticket_id TEXT NOT NULL REFERENCES hd_ticket(id) ON DELETE CASCADE,
  message_id TEXT REFERENCES hd_message(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hd_notification_user_id ON hd_notification(user_id);
CREATE INDEX IF NOT EXISTS idx_hd_notification_ticket_id ON hd_notification(ticket_id);
CREATE INDEX IF NOT EXISTS idx_hd_notification_read_at ON hd_notification(read_at);

CREATE TABLE IF NOT EXISTS hd_approval_config (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  group_id TEXT,
  sector_id TEXT,
  exige_aprovacao BOOLEAN NOT NULL DEFAULT true,
  tipo_aprovacao hd_approval_type NOT NULL DEFAULT 'by_level',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hd_approval_config_client_id ON hd_approval_config(client_id);
CREATE INDEX IF NOT EXISTS idx_hd_approval_config_group_id ON hd_approval_config(group_id);
CREATE INDEX IF NOT EXISTS idx_hd_approval_config_sector_id ON hd_approval_config(sector_id);

CREATE TABLE IF NOT EXISTS hd_approval_config_approver (
  id TEXT PRIMARY KEY,
  config_id TEXT NOT NULL REFERENCES hd_approval_config(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  ordem INTEGER,
  nivel INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(config_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_hd_approval_config_approver_config_id ON hd_approval_config_approver(config_id);
CREATE INDEX IF NOT EXISTS idx_hd_approval_config_approver_user_id ON hd_approval_config_approver(user_id);

CREATE TABLE IF NOT EXISTS hd_approval_log (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES hd_ticket(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  action hd_approval_action NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hd_approval_log_ticket_id ON hd_approval_log(ticket_id);
CREATE INDEX IF NOT EXISTS idx_hd_approval_log_user_id ON hd_approval_log(user_id);
