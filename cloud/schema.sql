PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS generations (
  id TEXT PRIMARY KEY, commit_sha TEXT NOT NULL, status TEXT NOT NULL,
  created_at TEXT NOT NULL, error TEXT NOT NULL DEFAULT '', embedding_model TEXT NOT NULL,
  chunk_count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS documents (
  generation TEXT NOT NULL, id TEXT NOT NULL, title TEXT NOT NULL, file TEXT NOT NULL,
  hash TEXT NOT NULL, folder_ids TEXT NOT NULL, tags TEXT NOT NULL,
  PRIMARY KEY (generation, id)
);
CREATE TABLE IF NOT EXISTS chunks (
  generation TEXT NOT NULL, id TEXT NOT NULL, note_id TEXT NOT NULL, title TEXT NOT NULL,
  heading TEXT NOT NULL, heading_index INTEGER NOT NULL, ordinal INTEGER NOT NULL,
  text TEXT NOT NULL, source_hash TEXT NOT NULL,
  PRIMARY KEY (generation, id)
);
CREATE INDEX IF NOT EXISTS chunks_note ON chunks(generation, note_id, ordinal);
CREATE VIRTUAL TABLE IF NOT EXISTS chunk_search USING fts5(generation UNINDEXED, id UNINDEXED, terms);
CREATE TABLE IF NOT EXISTS embedding_cache (id TEXT PRIMARY KEY, model TEXT NOT NULL, vector TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS extraction_cache (id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS wiki_pages (
  generation TEXT NOT NULL, slug TEXT NOT NULL, title TEXT NOT NULL, type TEXT NOT NULL,
  content TEXT NOT NULL, refs TEXT NOT NULL, links TEXT NOT NULL, aliases TEXT NOT NULL,
  evidence_hash TEXT NOT NULL, PRIMARY KEY (generation, slug)
);
CREATE TABLE IF NOT EXISTS wiki_revisions (
  slug TEXT NOT NULL, version INTEGER NOT NULL, content TEXT NOT NULL,
  source TEXT NOT NULL, evidence_hash TEXT NOT NULL, created_at TEXT NOT NULL, refs TEXT NOT NULL,
  PRIMARY KEY (slug, version)
);
CREATE TABLE IF NOT EXISTS wiki_edits (
  slug TEXT PRIMARY KEY, version INTEGER NOT NULL, content TEXT NOT NULL,
  evidence_hash TEXT NOT NULL, updated_at TEXT NOT NULL, refs TEXT NOT NULL, links TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_states (id TEXT PRIMARY KEY, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS auth_sessions (id TEXT PRIMARY KEY, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS login_attempts (id TEXT PRIMARY KEY, bucket INTEGER NOT NULL, attempts INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, messages TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS answer_tickets (
  id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, generation TEXT NOT NULL,
  payload TEXT NOT NULL, expires INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS daily_usage (day TEXT PRIMARY KEY, requests INTEGER NOT NULL);
