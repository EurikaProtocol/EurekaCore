-- EurekaCore durable state for Cloudflare D1 (see docs/PERSISTENCE.md).
CREATE TABLE IF NOT EXISTS agent_tasks (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('queued','running','completed','failed','cancelled')),
  record_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS agent_tasks_status ON agent_tasks (status);

CREATE TABLE IF NOT EXISTS approval_nonces (
  nonce TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL,
  consumed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS approval_nonces_expiry ON approval_nonces (expires_at);
