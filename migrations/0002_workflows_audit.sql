-- Orchestration workflows and the hash-chained audit log (see docs/ORCHESTRATION.md).
CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  status TEXT NOT NULL,
  record_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS workflows_status ON workflows (status);

CREATE TABLE IF NOT EXISTS audit_log (
  seq INTEGER PRIMARY KEY,
  subject TEXT NOT NULL,
  entry_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_log_subject ON audit_log (subject);
