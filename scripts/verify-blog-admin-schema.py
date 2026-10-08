#!/usr/bin/env python3
"""Verify the draft blog administrator SQL migration without touching Cloudflare."""
import sqlite3
from pathlib import Path

migration = Path(__file__).resolve().parents[1] / "db" / "blog-admin" / "0001_auth.sql"
db = sqlite3.connect(":memory:")
db.executescript(migration.read_text(encoding="utf-8"))
tables = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
expected = {"blog_admin_sessions", "blog_admin_attempts", "blog_admin_security_events"}
assert expected.issubset(tables), f"Missing tables: {expected - tables}"

db.execute("INSERT INTO blog_admin_sessions(token_hash, created_at, expires_at) VALUES (?, ?, ?)",
           ("dummy-hash", 100, 200))
db.execute("UPDATE blog_admin_sessions SET revoked_at = ? WHERE token_hash = ?", (150, "dummy-hash"))
assert db.execute("SELECT revoked_at FROM blog_admin_sessions WHERE token_hash='dummy-hash'").fetchone() == (150,)

db.execute("INSERT INTO blog_admin_attempts(actor_hash, window_id, attempt_count, failure_count)"
           " VALUES (?, ?, 1, 0) ON CONFLICT(actor_hash, window_id)"
           " DO UPDATE SET attempt_count = attempt_count + 1", ("test-ip-hash", 1))
db.execute("INSERT INTO blog_admin_attempts(actor_hash, window_id, attempt_count, failure_count)"
           " VALUES (?, ?, 1, 0) ON CONFLICT(actor_hash, window_id)"
           " DO UPDATE SET attempt_count = attempt_count + 1", ("test-ip-hash", 1))
assert db.execute("SELECT attempt_count FROM blog_admin_attempts").fetchone() == (2,)

db.execute("INSERT OR IGNORE INTO blog_admin_security_events(id, created_at, event_type, actor_hash,"
           " failure_count, notification_status) VALUES (?, ?, ?, ?, ?, ?)",
           ("event-1", 200, "four-plus-failed-logins", "test-ip-hash", 4, "pending"))
assert db.execute("SELECT notification_status FROM blog_admin_security_events").fetchone() == ("pending",)

print("PASS: draft admin D1 migration tables, session revocation, counters, pending events")
