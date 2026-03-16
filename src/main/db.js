import initSqlJs from 'sql.js'
import { app } from 'electron'
import { join } from 'path'
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'fs'
import SCHEMA from './schema.sql?raw'

// In a packaged app the WASM file is unpacked into process.resourcesPath.
// In dev it lives inside node_modules/sql.js/dist.
function sqlJsConfig() {
  if (app.isPackaged) {
    return { locateFile: () => join(process.resourcesPath, 'sql-wasm.wasm') }
  }
  return {}
}

let db
let _dbPath
let _inTransaction = false
let _SQL = null  // cached sql.js WASM instance

// ── Persistence ───────────────────────────────────────────────────────────────

function persist() {
  writeFileSync(_dbPath, Buffer.from(db.export()))
}

// ── better-sqlite3-compatible shim ────────────────────────────────────────────
// sql.js has a different API; this shim exposes prepare().run/get/all and
// db.transaction() so the rest of db.js doesn't need to change.

function bindParams(stmt, params) {
  if (!params || params.length === 0) return
  // Array of positional params
  if (Array.isArray(params)) {
    stmt.bind(params)
    return
  }
  // Object of named params — sql.js needs keys prefixed with @/$/:
  const bound = {}
  for (const [k, v] of Object.entries(params)) {
    bound[k.match(/^[@$:]/) ? k : `@${k}`] = v
  }
  stmt.bind(bound)
}

function rowsModified() {
  return db.getRowsModified()
}

function lastInsertRowid() {
  const stmt = db.prepare('SELECT last_insert_rowid() AS id')
  stmt.step()
  const { id } = stmt.getAsObject()
  stmt.free()
  return id
}

function prepare(sql) {
  return {
    run(...args) {
      // args may be (p1, p2, ...) or ({named}) or ([arr])
      const params = args.length === 1 && typeof args[0] === 'object' && !Array.isArray(args[0])
        ? args[0]
        : args.flat()
      const stmt = db.prepare(sql)
      bindParams(stmt, Array.isArray(params) && params.length === 0 ? null : params)
      stmt.step()
      stmt.free()
      if (!_inTransaction) persist()
      return { changes: rowsModified(), lastInsertRowid: lastInsertRowid() }
    },
    get(...args) {
      const params = args.length === 1 && typeof args[0] === 'object' && !Array.isArray(args[0])
        ? args[0]
        : args.flat()
      const stmt = db.prepare(sql)
      bindParams(stmt, Array.isArray(params) && params.length === 0 ? null : params)
      const found = stmt.step()
      const row = found ? stmt.getAsObject() : undefined
      stmt.free()
      return row
    },
    all(...args) {
      const params = args.length === 1 && typeof args[0] === 'object' && !Array.isArray(args[0])
        ? args[0]
        : args.flat()
      const stmt = db.prepare(sql)
      bindParams(stmt, Array.isArray(params) && params.length === 0 ? null : params)
      const rows = []
      while (stmt.step()) rows.push(stmt.getAsObject())
      stmt.free()
      return rows
    }
  }
}

function transaction(fn) {
  return (...args) => {
    _inTransaction = true
    db.run('BEGIN')
    let committed = false
    try {
      const result = fn(...args)
      db.run('COMMIT')
      committed = true
      persist()
      return result
    } catch (e) {
      if (!committed) db.run('ROLLBACK')
      throw e
    } finally {
      _inTransaction = false
    }
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

export async function initDb(dbPath) {
  if (dbPath) {
    _dbPath = dbPath
  } else {
    const dataDir = join(app.getPath('home'), '.vinance')
    mkdirSync(dataDir, { recursive: true })
    _dbPath = join(dataDir, 'vinance.db')
  }

  if (!_SQL) _SQL = await initSqlJs(sqlJsConfig())
  db = existsSync(_dbPath)
    ? new _SQL.Database(readFileSync(_dbPath))
    : new _SQL.Database()

  db.run('PRAGMA foreign_keys = ON')
  db.exec(SCHEMA)

  // Migration: drop path column from categories (paths now computed via recursive CTE)
  const colStmt = db.prepare('PRAGMA table_info(categories)')
  let hasCatPath = false
  while (colStmt.step()) { if (colStmt.getAsObject().name === 'path') hasCatPath = true }
  colStmt.free()
  if (hasCatPath) {
    db.run('PRAGMA foreign_keys = OFF')
    db.exec(`
      CREATE TABLE categories_new (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        name      TEXT NOT NULL
      );
      INSERT INTO categories_new (id, parent_id, name)
        SELECT id, parent_id, name FROM categories;
      DROP TABLE categories;
      ALTER TABLE categories_new RENAME TO categories;
    `)
    db.run('PRAGMA foreign_keys = ON')
  }

  // Migration: add transfer_account_id for pending (unmatched) transfers
  const txCols = []
  const txColStmt = db.prepare('PRAGMA table_info(transactions)')
  while (txColStmt.step()) txCols.push(txColStmt.getAsObject().name)
  txColStmt.free()
  if (!txCols.includes('transfer_account_id')) {
    db.run('ALTER TABLE transactions ADD COLUMN transfer_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL')
  }

  // Migration: make fitid nullable to allow synthetic mirror transactions
  // SQLite can't ALTER COLUMN, so we recreate the table if the old NOT NULL constraint exists.
  const fitidInfo = (() => {
    const s = db.prepare('PRAGMA table_info(transactions)')
    const cols = []
    while (s.step()) cols.push(s.getAsObject())
    s.free()
    return cols.find(c => c.name === 'fitid')
  })()
  if (fitidInfo && fitidInfo.notnull === 1) {
    db.run('PRAGMA foreign_keys = OFF')
    db.run(`
      CREATE TABLE transactions_new (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id       INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        fitid            TEXT,
        date             TEXT    NOT NULL,
        amount           REAL    NOT NULL,
        payee            TEXT,
        memo             TEXT,
        raw_type         TEXT,
        category_id      INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        is_transfer         INTEGER NOT NULL DEFAULT 0,
        transfer_pair_id    INTEGER REFERENCES transactions_new(id) ON DELETE SET NULL,
        transfer_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
        imported_at      TEXT    NOT NULL DEFAULT (datetime('now')),
        UNIQUE (account_id, fitid)
      )
    `)
    db.run(`
      INSERT INTO transactions_new
        (id, account_id, fitid, date, amount, payee, memo, raw_type,
         category_id, is_transfer, transfer_pair_id, transfer_account_id, imported_at)
      SELECT
        id, account_id, fitid, date, amount, payee, memo, raw_type,
        category_id, is_transfer, transfer_pair_id, transfer_account_id,
        COALESCE(imported_at, datetime('now'))
      FROM transactions
    `)
    db.run(`DROP TABLE transactions`)
    db.run(`ALTER TABLE transactions_new RENAME TO transactions`)
    db.run('PRAGMA foreign_keys = ON')
  }

  persist()
}

export function getDb() { return db }
export function getCurrentDbPath() { return _dbPath }

// ── Category path CTE ─────────────────────────────────────────────────────────
// Computes display path (e.g. "Food/Groceries") from parent_id chain at query time.

const CAT_CTE = `
  WITH RECURSIVE cat_path(id, parent_id, name, path) AS (
    SELECT id, parent_id, name, name AS path FROM categories WHERE parent_id IS NULL
    UNION ALL
    SELECT c.id, c.parent_id, c.name, cat_path.path || '/' || c.name
    FROM categories c JOIN cat_path ON c.parent_id = cat_path.id
  )
`

function categoryDescendantIds(categoryId) {
  return prepare(`
    WITH RECURSIVE desc_cats(id) AS (
      SELECT id FROM categories WHERE id = ?
      UNION ALL
      SELECT c.id FROM categories c JOIN desc_cats ON c.parent_id = desc_cats.id
    )
    SELECT id FROM desc_cats
  `).all(categoryId).map(r => r.id)
}

// ── Accounts ──────────────────────────────────────────────────────────────────

export const accounts = {
  list() {
    return prepare(`
      SELECT a.*,
             COALESCE(SUM(CASE WHEN t.is_transfer = 0 THEN t.amount ELSE 0 END), 0) AS balance
      FROM accounts a
      LEFT JOIN transactions t ON t.account_id = a.id
      GROUP BY a.id
      ORDER BY a.name
    `).all()
  },
  create({ name, currency, type }) {
    prepare('INSERT INTO accounts (name, currency, type) VALUES (?, ?, ?)').run(name, currency || 'USD', type || 'checking')
    return prepare('SELECT * FROM accounts ORDER BY id DESC LIMIT 1').get()
  },
  rename(id, name) {
    return prepare('UPDATE accounts SET name = ? WHERE id = ?').run(name, id)
  },
  getById(id) {
    return prepare('SELECT * FROM accounts WHERE id = ?').get(id)
  },
  findByBankInfo(bankId, acctId) {
    return prepare("SELECT * FROM accounts WHERE name LIKE ? LIMIT 1").get(`%${acctId}%`)
  },
  delete(id) {
    prepare('DELETE FROM imports      WHERE account_id = ?').run(id)
    prepare('DELETE FROM transactions WHERE account_id = ?').run(id)
    prepare('DELETE FROM accounts     WHERE id = ?').run(id)
  }
}

// ── Transactions ──────────────────────────────────────────────────────────────

export const transactions = {
  list({ accountId, page = 1, limit = 50, dateFrom, dateTo, categoryId, search, uncategorized } = {}) {
    const conditions = []
    const params = []

    if (accountId)  { conditions.push('t.account_id = ?');   params.push(accountId) }
    if (dateFrom)   { conditions.push('t.date >= ?');         params.push(dateFrom) }
    if (dateTo)     { conditions.push('t.date <= ?');         params.push(dateTo) }
    if (search) {
      conditions.push('(t.payee LIKE ? OR t.memo LIKE ?)')
      params.push(`%${search}%`, `%${search}%`)
    }
    if (uncategorized) {
      conditions.push('t.category_id IS NULL AND t.is_transfer = 0')
    }
    if (categoryId) {
      const ids = categoryDescendantIds(categoryId)
      if (ids.length) {
        conditions.push(`t.category_id IN (${ids.map(() => '?').join(',')})`)
        params.push(...ids)
      }
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''
    const offset = (page - 1) * limit

    const rows = prepare(`
      ${CAT_CTE}
      SELECT t.*, cat_path.path AS category_path, a.currency
      FROM transactions t
      LEFT JOIN cat_path ON cat_path.id = t.category_id
      LEFT JOIN accounts a ON a.id = t.account_id
      ${where}
      ORDER BY t.date DESC, t.id DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset)

    const totalRow = prepare(`
      SELECT COUNT(*) AS total FROM transactions t ${where}
    `).get(...params)

    return { rows, total: totalRow?.total ?? 0, page, limit }
  },

  insertMany(accountId, txList) {
    let imported = 0
    const insertAll = transaction((list) => {
      for (const tx of list) {
        // INSERT OR IGNORE via check-then-insert
        const existing = prepare(
          'SELECT id FROM transactions WHERE account_id = ? AND fitid = ?'
        ).get(accountId, tx.fitid)
        if (!existing) {
          prepare(`
            INSERT INTO transactions (account_id, fitid, date, amount, payee, memo, raw_type)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(accountId, tx.fitid, tx.date, tx.amount, tx.payee, tx.memo, tx.rawType)
          imported++
        }
      }
    })
    insertAll(txList)
    return { imported, skipped: txList.length - imported }
  },

  setCategory(id, categoryId) {
    return prepare('UPDATE transactions SET category_id = ? WHERE id = ?').run(categoryId, id)
  },

  linkTransfer(id1, id2) {
    transaction(() => {
      prepare('UPDATE transactions SET is_transfer = 1, transfer_pair_id = ? WHERE id = ?').run(id2, id1)
      prepare('UPDATE transactions SET is_transfer = 1, transfer_pair_id = ? WHERE id = ?').run(id1, id2)
    })()
  },

  unlinkTransfer(id) {
    const tx = prepare('SELECT transfer_pair_id FROM transactions WHERE id = ?').get(id)
    transaction(() => {
      prepare('UPDATE transactions SET is_transfer = 0, transfer_pair_id = NULL, transfer_account_id = NULL WHERE id = ?').run(id)
      if (tx?.transfer_pair_id) {
        prepare('UPDATE transactions SET is_transfer = 0, transfer_pair_id = NULL, transfer_account_id = NULL WHERE id = ?').run(tx.transfer_pair_id)
      }
    })()
  },

  markPendingTransfer(id, accountId) {
    prepare(
      'UPDATE transactions SET is_transfer = 1, transfer_pair_id = NULL, transfer_account_id = ? WHERE id = ?'
    ).run(accountId, id)
  },

  // Creates a synthetic mirror transaction in the target account and links both sides immediately.
  // The mirror has no fitid so it can be upgraded to a real imported transaction later.
  createMirrorTransfer(sourceId, targetAccountId) {
    const src = prepare('SELECT * FROM transactions WHERE id = ?').get(sourceId)
    if (!src) throw new Error('Source transaction not found')
    transaction(() => {
      prepare(`
        INSERT INTO transactions (account_id, date, amount, payee, memo, is_transfer, transfer_pair_id)
        VALUES (?, ?, ?, ?, ?, 1, ?)
      `).run(targetAccountId, src.date, -src.amount, src.payee, src.memo, sourceId)
      const mirrorId = lastInsertRowid()
      prepare('UPDATE transactions SET is_transfer = 1, transfer_pair_id = ?, transfer_account_id = NULL WHERE id = ?')
        .run(mirrorId, sourceId)
    })()
  },

  // Called after import — upgrades any synthetic mirrors (fitid IS NULL) in this account
  // to their real imported counterparts, then re-links the source transaction.
  reconcileSyntheticMirrors(accountId) {
    const synthetics = prepare(`
      SELECT * FROM transactions
      WHERE account_id = ? AND fitid IS NULL AND is_transfer = 1 AND transfer_pair_id IS NOT NULL
    `).all(accountId)

    let upgraded = 0
    for (const s of synthetics) {
      const real = prepare(`
        SELECT * FROM transactions
        WHERE account_id = ?
          AND amount = ?
          AND fitid IS NOT NULL
          AND is_transfer = 0
          AND ABS(JULIANDAY(date) - JULIANDAY(?)) <= 5
        ORDER BY ABS(JULIANDAY(date) - JULIANDAY(?))
        LIMIT 1
      `).get(accountId, s.amount, s.date, s.date)

      if (real) {
        transaction(() => {
          // Re-link source → real, mark real as transfer
          prepare('UPDATE transactions SET transfer_pair_id = ?, transfer_account_id = NULL WHERE id = ?')
            .run(real.id, s.transfer_pair_id)
          prepare('UPDATE transactions SET is_transfer = 1, transfer_pair_id = ? WHERE id = ?')
            .run(s.transfer_pair_id, real.id)
          // Delete the synthetic mirror
          prepare('DELETE FROM transactions WHERE id = ?').run(s.id)
        })()
        upgraded++
      }
    }
    return upgraded
  },

  // Called after import — tries to link pending transfers with newly imported transactions
  reconcilePendingTransfers(accountId) {
    const pending = prepare(`
      SELECT * FROM transactions
      WHERE is_transfer = 1 AND transfer_pair_id IS NULL AND transfer_account_id = ?
    `).all(accountId)

    let linked = 0
    for (const p of pending) {
      // Find best match in the target account: opposite amount, within 5 days
      const match = prepare(`
        SELECT * FROM transactions
        WHERE account_id = ?
          AND amount = ?
          AND is_transfer = 0
          AND ABS(JULIANDAY(date) - JULIANDAY(?)) <= 5
        ORDER BY ABS(JULIANDAY(date) - JULIANDAY(?))
        LIMIT 1
      `).get(accountId, -p.amount, p.date, p.date)

      if (match) {
        transaction(() => {
          prepare('UPDATE transactions SET is_transfer = 1, transfer_pair_id = ?, transfer_account_id = NULL WHERE id = ?').run(match.id, p.id)
          prepare('UPDATE transactions SET is_transfer = 1, transfer_pair_id = ?, transfer_account_id = NULL WHERE id = ?').run(p.id, match.id)
        })()
        linked++
      }
    }
    return linked
  }
}

// ── Categories ────────────────────────────────────────────────────────────────

export const categories = {
  all() {
    return prepare(`
      ${CAT_CTE}
      SELECT id, parent_id, name, path FROM cat_path ORDER BY path
    `).all()
  },
  create({ parentId, name }) {
    const result = prepare(
      'INSERT INTO categories (parent_id, name) VALUES (?, ?)'
    ).run(parentId || null, name)
    return result.lastInsertRowid
  },
  rename(id, name) {
    prepare('UPDATE categories SET name = ? WHERE id = ?').run(name, id)
  }
}

// ── Rules ─────────────────────────────────────────────────────────────────────

export const rules = {
  list() {
    return prepare(`
      ${CAT_CTE}
      SELECT r.*, cat_path.path AS category_path
      FROM rules r
      JOIN cat_path ON cat_path.id = r.category_id
      ORDER BY r.priority DESC, r.id
    `).all()
  },
  create({ pattern, field, categoryId, priority = 0 }) {
    return prepare(
      'INSERT INTO rules (pattern, field, category_id, priority) VALUES (?, ?, ?, ?)'
    ).run(pattern, field, categoryId, priority)
  },
  update(id, { pattern, field, categoryId, priority }) {
    return prepare(
      'UPDATE rules SET pattern = ?, field = ?, category_id = ?, priority = ? WHERE id = ?'
    ).run(pattern, field, categoryId, priority, id)
  },
  delete(id) {
    return prepare('DELETE FROM rules WHERE id = ?').run(id)
  },
  applyAll() {
    const ruleList = rules.list()
    const uncategorized = prepare('SELECT * FROM transactions WHERE category_id IS NULL').all()

    let count = 0
    const apply = transaction((txs) => {
      for (const tx of txs) {
        for (const rule of ruleList) {
          const haystack = (rule.field === 'payee' ? tx.payee : tx.memo) || ''
          let matched = false
          try {
            matched = new RegExp(rule.pattern, 'i').test(haystack)
          } catch {
            matched = haystack.toLowerCase().includes(rule.pattern.toLowerCase())
          }
          if (matched) {
            prepare('UPDATE transactions SET category_id = ? WHERE id = ?').run(rule.category_id, tx.id)
            count++
            break
          }
        }
      }
    })
    apply(uncategorized)
    return count
  }
}

// ── Imports ───────────────────────────────────────────────────────────────────

export const imports = {
  log({ accountId, filename, txCount, skippedCount }) {
    return prepare(
      'INSERT INTO imports (account_id, filename, tx_count, skipped_count) VALUES (?, ?, ?, ?)'
    ).run(accountId, filename, txCount, skippedCount)
  },
  list(accountId) {
    return prepare(
      'SELECT * FROM imports WHERE account_id = ? ORDER BY imported_at DESC'
    ).all(accountId)
  }
}

// ── Reports ───────────────────────────────────────────────────────────────────

export const reports = {
  summary({ dateFrom, dateTo, accountIds = [] }) {
    const accountFilter = accountIds.length
      ? `AND account_id IN (${accountIds.map(() => '?').join(',')})`
      : ''
    const params = [dateFrom, dateTo, ...accountIds]

    const rows = prepare(`
      ${CAT_CTE}
      SELECT
        cat_path.path AS category_path,
        cat_path.id   AS category_id,
        SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END) AS income,
        SUM(CASE WHEN t.amount < 0 THEN t.amount ELSE 0 END) AS expense
      FROM transactions t
      LEFT JOIN cat_path ON cat_path.id = t.category_id
      WHERE t.is_transfer = 0
        AND t.date BETWEEN ? AND ?
        ${accountFilter}
      GROUP BY cat_path.id
      ORDER BY cat_path.path
    `).all(...params)

    const byPeriod = prepare(`
      SELECT
        strftime('%Y-%m', t.date) AS period,
        SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END) AS income,
        SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END) AS expense
      FROM transactions t
      WHERE t.is_transfer = 0
        AND t.date BETWEEN ? AND ?
        ${accountFilter}
      GROUP BY period
      ORDER BY period
    `).all(...params)

    const totals = rows.reduce(
      (acc, r) => ({ income: acc.income + r.income, expense: acc.expense + r.expense }),
      { income: 0, expense: 0 }
    )

    return { ...totals, byCategory: rows, byPeriod }
  }
}

// ── Budgets ───────────────────────────────────────────────────────────────────

export const budgets = {
  list({ year, month } = {}) {
    const conditions = ['b.year = ?']
    const params = [year]
    if (month != null) {
      conditions.push('(b.month = ? OR b.period = ?)')
      params.push(month, 'yearly')
    }

    return prepare(`
      ${CAT_CTE},
      cat_desc(ancestor_id, descendant_id) AS (
        SELECT id, id FROM categories
        UNION ALL
        SELECT cd.ancestor_id, c.id
        FROM categories c JOIN cat_desc cd ON c.parent_id = cd.descendant_id
      )
      SELECT b.*, cat_path.path AS category_path,
             COALESCE(SUM(ABS(t.amount)), 0) AS actual
      FROM budgets b
      JOIN cat_path ON cat_path.id = b.category_id
      LEFT JOIN transactions t
        ON t.category_id IN (
          SELECT descendant_id FROM cat_desc WHERE ancestor_id = b.category_id
        )
        AND t.is_transfer = 0
        AND t.amount < 0
        AND (
          (b.period = 'monthly' AND strftime('%Y-%m', t.date) = printf('%04d-%02d', b.year, b.month))
          OR
          (b.period = 'yearly'  AND strftime('%Y', t.date) = CAST(b.year AS TEXT))
        )
      WHERE ${conditions.join(' AND ')}
      GROUP BY b.id
      ORDER BY cat_path.path
    `).all(...params)
  },

  upsert({ categoryId, amount, period, year, month }) {
    // sql.js doesn't support ON CONFLICT DO UPDATE in older SQLite — do it manually
    const existing = prepare(
      'SELECT id FROM budgets WHERE category_id = ? AND period = ? AND year = ? AND month IS ?'
    ).get(categoryId, period, year, month ?? null)

    if (existing) {
      return prepare('UPDATE budgets SET amount = ? WHERE id = ?').run(amount, existing.id)
    }
    return prepare(
      'INSERT INTO budgets (category_id, amount, period, year, month) VALUES (?, ?, ?, ?, ?)'
    ).run(categoryId, amount, period, year, month ?? null)
  },

  delete(id) {
    return prepare('DELETE FROM budgets WHERE id = ?').run(id)
  }
}
