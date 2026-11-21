CREATE TABLE IF NOT EXISTS classes (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  teacher_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS members (
  class_code TEXT NOT NULL,
  device TEXT NOT NULL,
  no INTEGER NOT NULL CHECK (no BETWEEN 1 AND 99),
  answered INTEGER NOT NULL DEFAULT 0,
  correct INTEGER NOT NULL DEFAULT 0,
  joined_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  PRIMARY KEY (class_code, device)
);

CREATE TABLE IF NOT EXISTS word_stats (
  class_code TEXT NOT NULL,
  en TEXT NOT NULL,
  correct INTEGER NOT NULL DEFAULT 0,
  wrong INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (class_code, en)
);

CREATE TABLE IF NOT EXISTS sync_batches (
  class_code TEXT NOT NULL,
  device TEXT NOT NULL,
  batch TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  applied INTEGER NOT NULL DEFAULT 0 CHECK (applied IN (0, 1)),
  PRIMARY KEY (class_code, device, batch)
);

CREATE INDEX IF NOT EXISTS sync_batches_expiry
  ON sync_batches (class_code, device, created_at);
