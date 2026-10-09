-- Apply once to the explicit production or staging D1 selected in Cloudflare.
-- Additive only: never replaces private drafts, sessions, form data, or financial records.
CREATE TABLE IF NOT EXISTS blog_publications (
  slug TEXT PRIMARY KEY NOT NULL CHECK (length(slug) BETWEEN 1 AND 100),
  draft_id TEXT NOT NULL UNIQUE,
  revision INTEGER NOT NULL CHECK (revision > 0),
  is_published INTEGER NOT NULL CHECK (is_published IN (0, 1)),
  article_json TEXT NOT NULL CHECK (length(article_json) BETWEEN 2 AND 55000),
  published_at TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS blog_publication_revisions (
  slug TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  action TEXT NOT NULL CHECK (action IN ('publish', 'update', 'unpublish', 'restore')),
  article_json TEXT NOT NULL CHECK (length(article_json) BETWEEN 2 AND 55000),
  recorded_at INTEGER NOT NULL,
  PRIMARY KEY (slug, revision),
  FOREIGN KEY (slug) REFERENCES blog_publications(slug)
);
CREATE INDEX IF NOT EXISTS blog_publications_live ON blog_publications(is_published,updated_at DESC);

-- Reviewed public homepage promotion (separate from the private homepage draft).
CREATE TABLE IF NOT EXISTS blog_homepage_publication (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL CHECK (revision > 0),
  is_published INTEGER NOT NULL CHECK (is_published IN (0, 1)),
  content_json TEXT NOT NULL CHECK (length(content_json) BETWEEN 2 AND 10000),
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS blog_homepage_publication_revisions (
  revision INTEGER PRIMARY KEY NOT NULL CHECK (revision > 0),
  action TEXT NOT NULL CHECK (action IN ('publish','revert','restore')),
  content_json TEXT NOT NULL CHECK (length(content_json) BETWEEN 2 AND 10000),
  recorded_at INTEGER NOT NULL
);