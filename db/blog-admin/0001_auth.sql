-- FundLenz blog administration: deploy only to an isolated, owner-approved D1 database.
-- No financial data tables. No raw passwords, session tokens or raw IP addresses stored here.
CREATE TABLE IF NOT EXISTS blog_admin_sessions (
  token_hash TEXT PRIMARY KEY NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE INDEX IF NOT EXISTS blog_admin_sessions_expiry ON blog_admin_sessions(expires_at);

CREATE TABLE IF NOT EXISTS blog_admin_attempts (
  actor_hash TEXT NOT NULL,
  window_id INTEGER NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (actor_hash, window_id)
);
CREATE INDEX IF NOT EXISTS blog_admin_attempts_window ON blog_admin_attempts(window_id);

CREATE TABLE IF NOT EXISTS blog_admin_security_events (
  id TEXT PRIMARY KEY NOT NULL,
  created_at INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  actor_hash TEXT NOT NULL,
  failure_count INTEGER NOT NULL,
  notification_status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS blog_admin_security_events_pending
  ON blog_admin_security_events(notification_status, created_at);
