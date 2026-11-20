CREATE TABLE accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

CREATE INDEX sessions_expires_at ON sessions(expires_at);

CREATE TABLE catalog_sources (
  id TEXT PRIMARY KEY,
  document TEXT NOT NULL CHECK (length(CAST(document AS BLOB)) <= 524288),
  updated_at INTEGER NOT NULL
);
