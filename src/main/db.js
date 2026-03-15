import initSqlJs from 'sql.js'
import { app } from 'electron'
import { join } from 'path'
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'fs'
import SCHEMA from './schema.sql?raw'

let db
let _dbPath
let _inTransaction = false

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

export async function initDb() {
  const dataDir = join(app.getPath('home'), '.vinance')
  mkdirSync(dataDir, { recursive: true })
  _dbPath = join(dataDir, 'vinance.db')

  const SQL = await initSqlJs()
  db = existsSync(_dbPath)
    ? new SQL.Database(readFileSync(_dbPath))
    : new SQL.Database()

  db.run('PRAGMA foreign_keys = ON')

  db.exec(SCHEMA)
  persist()
}

export function getDb() { return db }

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
  }
}

// ── Transactions ──────────────────────────────────────────────────────────────

export const transactions = {
  list({ accountId, page = 1, limit = 50, dateFrom, dateTo, categoryId } = {}) {
    const conditions = []
    const params = []

    if (accountId)  { conditions.push('t.account_id = ?');   params.push(accountId) }
    if (dateFrom)   { conditions.push('t.date >= ?');         params.push(dateFrom) }
    if (dateTo)     { conditions.push('t.date <= ?');         params.push(dateTo) }
    if (categoryId) { conditions.push('t.category_id = ?');   params.push(categoryId) }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''
    const offset = (page - 1) * limit

    const rows = prepare(`
      SELECT t.*, c.path AS category_path, a.currency
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
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
      prepare('UPDATE transactions SET is_transfer = 0, transfer_pair_id = NULL WHERE id = ?').run(id)
      if (tx?.transfer_pair_id) {
        prepare('UPDATE transactions SET is_transfer = 0, transfer_pair_id = NULL WHERE id = ?').run(tx.transfer_pair_id)
      }
    })()
  }
}

// ── Categories ────────────────────────────────────────────────────────────────

export const categories = {
  all() {
    return prepare('SELECT * FROM categories ORDER BY path').all()
  },
  create({ parentId, name }) {
    let path = name
    if (parentId) {
      const parent = prepare('SELECT path FROM categories WHERE id = ?').get(parentId)
      if (parent) path = `${parent.path}/${name}`
    }
    const result = prepare(
      'INSERT INTO categories (parent_id, name, path) VALUES (?, ?, ?)'
    ).run(parentId || null, name, path)
    return result.lastInsertRowid
  },
  rename(id, name) {
    const cat = prepare('SELECT * FROM categories WHERE id = ?').get(id)
    const parentPath = cat.parent_id
      ? prepare('SELECT path FROM categories WHERE id = ?').get(cat.parent_id)?.path
      : null
    const newPath = parentPath ? `${parentPath}/${name}` : name
    prepare('UPDATE categories SET name = ?, path = ? WHERE id = ?').run(name, newPath, id)
    // Update paths of all descendants
    const oldPrefix = cat.path + '/'
    const newPrefix = newPath + '/'
    const descendants = prepare("SELECT id, path FROM categories WHERE path LIKE ?").all(oldPrefix + '%')
    for (const d of descendants) {
      prepare('UPDATE categories SET path = ? WHERE id = ?').run(
        d.path.replace(oldPrefix, newPrefix), d.id
      )
    }
  }
}

// ── Rules ─────────────────────────────────────────────────────────────────────

export const rules = {
  list() {
    return prepare(`
      SELECT r.*, c.path AS category_path
      FROM rules r
      JOIN categories c ON c.id = r.category_id
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
      SELECT
        c.path   AS category_path,
        c.id     AS category_id,
        SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END) AS income,
        SUM(CASE WHEN t.amount < 0 THEN t.amount ELSE 0 END) AS expense
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.is_transfer = 0
        AND t.date BETWEEN ? AND ?
        ${accountFilter}
      GROUP BY c.id
      ORDER BY c.path
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
      SELECT b.*, c.path AS category_path,
             COALESCE(SUM(ABS(t.amount)), 0) AS actual
      FROM budgets b
      JOIN categories c ON c.id = b.category_id
      LEFT JOIN transactions t
        ON t.category_id = b.category_id
        AND t.is_transfer = 0
        AND t.amount < 0
        AND (
          (b.period = 'monthly' AND strftime('%Y-%m', t.date) = printf('%04d-%02d', b.year, b.month))
          OR
          (b.period = 'yearly'  AND strftime('%Y', t.date) = CAST(b.year AS TEXT))
        )
      WHERE ${conditions.join(' AND ')}
      GROUP BY b.id
      ORDER BY c.path
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
