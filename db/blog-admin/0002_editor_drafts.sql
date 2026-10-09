-- FundLenz isolated editorial drafts for reviewed staging OR production D1.
-- Apply only to the explicitly selected database after confirming its identity.
-- NO GitHub writes, no public publishing, no visitor email/submission storage.
-- Safe to apply repeatedly. Does not modify existing login tables.
CREATE TABLE IF NOT EXISTS blog_homepage_draft (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  content_json TEXT NOT NULL CHECK (length(content_json) BETWEEN 2 AND 10000),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS blog_article_drafts (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  summary TEXT NOT NULL DEFAULT '' CHECK (length(summary) <= 600),
  body_markdown TEXT NOT NULL DEFAULT '' CHECK (length(body_markdown) <= 50000),
  category TEXT NOT NULL DEFAULT 'Research' CHECK (category IN ('Research','Markets','Funds','Learning')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status = 'draft'),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS blog_article_drafts_recent ON blog_article_drafts(updated_at DESC);
