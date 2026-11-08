-- Native TINAN AI Builder projects owned by verified EurekaCore users (see docs/TINAN_BUILDER_INTEGRATION.md).
-- owner_email is only ever written from a server-verified identity; every read filters on it.
CREATE TABLE IF NOT EXISTS builder_projects (
  id TEXT PRIMARY KEY,
  owner_email TEXT NOT NULL,
  status TEXT NOT NULL,
  version INTEGER NOT NULL,
  record_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS builder_projects_owner ON builder_projects (owner_email, updated_at);
