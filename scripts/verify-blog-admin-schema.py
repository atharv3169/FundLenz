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

# Editorial migrations are applied to the same isolated staging D1 database.
# No public blog content or production financial data is changed by this test.
migration2 = Path(__file__).resolve().parents[1] / "db" / "blog-admin" / "0002_editor_drafts.sql"
db.executescript(migration2.read_text(encoding="utf-8"))
db.executescript(migration2.read_text(encoding="utf-8"))  # idempotency
tables = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
assert {"blog_homepage_draft", "blog_article_drafts"}.issubset(tables)
db.execute("INSERT INTO blog_homepage_draft (id, content_json, version, updated_at) VALUES (1, ?, 1, 100)", ('{"headline":"test"}',))
assert db.execute("UPDATE blog_homepage_draft SET version=version+1 WHERE id=1 AND version=1").rowcount == 1
assert db.execute("UPDATE blog_homepage_draft SET version=version+1 WHERE id=1 AND version=1").rowcount == 0
db.execute("INSERT INTO blog_article_drafts (id,title,summary,body_markdown,category,status,version,created_at,updated_at) "
           "VALUES (?,?,?,?,?,'draft',1,100,100)", ("test-uuid","Example","","Hello","Research"))
assert db.execute("UPDATE blog_article_drafts SET title=?,version=version+1 "
                  "WHERE id=? AND version=? AND status='draft'",
                  ("Changed", "test-uuid", 1)).rowcount == 1
assert db.execute("UPDATE blog_article_drafts SET title=? WHERE id=? AND version=?",
                  ("Stale", "test-uuid", 1)).rowcount == 0
try:
    db.execute("UPDATE blog_article_drafts SET status='published' WHERE id='test-uuid'")
except sqlite3.IntegrityError:
    pass
else:
    raise AssertionError("Draft API database must forbid published status")
assert db.execute("SELECT status FROM blog_article_drafts").fetchone() == ("draft",)
print("PASS: staging admin and editor D1 migration tables, session revocation, counters, pending events")
