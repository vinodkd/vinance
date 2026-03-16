CREATE TABLE IF NOT EXISTS accounts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  currency    TEXT    NOT NULL DEFAULT 'USD',
  type        TEXT    NOT NULL DEFAULT 'checking',
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id   INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  name        TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id       INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  fitid            TEXT    NOT NULL,
  date             TEXT    NOT NULL,  -- ISO 8601 YYYY-MM-DD
  amount           REAL    NOT NULL,
  payee            TEXT,
  memo             TEXT,
  raw_type         TEXT,              -- DEBIT / CREDIT / etc from OFX
  category_id      INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  is_transfer         INTEGER NOT NULL DEFAULT 0,
  transfer_pair_id    INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
  transfer_account_id INTEGER REFERENCES accounts(id)    ON DELETE SET NULL,
  imported_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (account_id, fitid)
);

CREATE TABLE IF NOT EXISTS rules (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern     TEXT    NOT NULL,
  field       TEXT    NOT NULL CHECK (field IN ('payee', 'memo')),
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  priority    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS budgets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  amount      REAL    NOT NULL,
  period      TEXT    NOT NULL CHECK (period IN ('monthly', 'yearly')),
  year        INTEGER NOT NULL,
  month       INTEGER,              -- NULL for yearly budgets
  UNIQUE (category_id, period, year, month)
);

CREATE TABLE IF NOT EXISTS imports (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id   INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  filename     TEXT    NOT NULL,
  imported_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  tx_count     INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date    ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
