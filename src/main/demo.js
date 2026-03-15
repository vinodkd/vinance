/**
 * Demo portfolio generator.
 *
 * Creates a fully-populated .vinance portfolio with 18 months of synthetic
 * transactions across 3 accounts, pre-seeded categories/rules/budgets, and
 * some linked transfers.
 *
 * Also writes a "demo-import.ofx" file alongside the portfolio containing
 * ~12 new transactions for the current month on Account 3 (second credit card),
 * including 3 intentional duplicates so the user sees deduplication in action.
 */

import { writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { initDb, getDb } from './db.js'

// ── Helpers ────────────────────────────────────────────────────────────────

function iso(date) {
  return date.toISOString().slice(0, 10)
}

/** Return a date offset by `months` from today, with optional day override */
function monthsAgo(n, day = null) {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - n)
  if (day) d.setDate(Math.min(day, daysInMonth(d.getFullYear(), d.getMonth() + 1)))
  return d
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

function rnd(min, max) {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100
}

function fitid(prefix, n) {
  return `${prefix}${String(n).padStart(6, '0')}`
}

// ── Category tree ──────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'income',        name: 'Income',       parent: null },
  { key: 'salary',        name: 'Salary',       parent: 'income' },
  { key: 'interest',      name: 'Interest',     parent: 'income' },
  { key: 'housing',       name: 'Housing',      parent: null },
  { key: 'rent',          name: 'Rent',         parent: 'housing' },
  { key: 'utilities',     name: 'Utilities',    parent: 'housing' },
  { key: 'internet',      name: 'Internet',     parent: 'housing' },
  { key: 'food',          name: 'Food',         parent: null },
  { key: 'groceries',     name: 'Groceries',    parent: 'food' },
  { key: 'dining',        name: 'Dining Out',   parent: 'food' },
  { key: 'coffee',        name: 'Coffee',       parent: 'food' },
  { key: 'transport',     name: 'Transport',    parent: null },
  { key: 'gas',           name: 'Gas',          parent: 'transport' },
  { key: 'rideshare',     name: 'Rideshare',    parent: 'transport' },
  { key: 'entertainment', name: 'Entertainment', parent: null },
  { key: 'streaming',     name: 'Streaming',    parent: 'entertainment' },
  { key: 'gym',           name: 'Gym',          parent: 'entertainment' },
  { key: 'healthcare',    name: 'Healthcare',   parent: null },
  { key: 'doctor',        name: 'Doctor',       parent: 'healthcare' },
  { key: 'pharmacy',      name: 'Pharmacy',     parent: 'healthcare' },
  { key: 'shopping',      name: 'Shopping',     parent: null },
  { key: 'clothing',      name: 'Clothing',     parent: 'shopping' },
  { key: 'online',        name: 'Online',       parent: 'shopping' },
  { key: 'savings_cat',   name: 'Savings',      parent: null },
]

// ── Rules ──────────────────────────────────────────────────────────────────

const RULES = [
  { pattern: 'DIRECT DEPOSIT|PAYROLL',  field: 'payee', category: 'salary',    priority: 10 },
  { pattern: 'INTEREST',                field: 'payee', category: 'interest',   priority: 10 },
  { pattern: 'RENT|APARTMENT',          field: 'payee', category: 'rent',       priority: 9  },
  { pattern: 'ELECTRIC|UTILITY|GAS CO', field: 'payee', category: 'utilities',  priority: 8  },
  { pattern: 'INTERNET|COMCAST|XFINITY',field: 'payee', category: 'internet',   priority: 8  },
  { pattern: 'WHOLE FOODS|TRADER JOE|SAFEWAY|KROGER|COSTCO', field: 'payee', category: 'groceries', priority: 7 },
  { pattern: 'CHIPOTLE|PANDA|MCDONALDS|SUBWAY|RESTAURANT|PIZZA|SUSHI', field: 'payee', category: 'dining', priority: 7 },
  { pattern: 'STARBUCKS|BLUE BOTTLE|DUNKIN', field: 'payee', category: 'coffee', priority: 7 },
  { pattern: 'SHELL|CHEVRON|EXXON|BP|ARCO', field: 'payee', category: 'gas',    priority: 7 },
  { pattern: 'LYFT|UBER',               field: 'payee', category: 'rideshare',  priority: 7 },
  { pattern: 'NETFLIX|SPOTIFY|HULU|DISNEY|HBO|APPLE', field: 'payee', category: 'streaming', priority: 6 },
  { pattern: 'PLANET FITNESS|GYM|YMCA', field: 'payee', category: 'gym',        priority: 6 },
  { pattern: 'CVS|WALGREENS|PHARMACY',  field: 'payee', category: 'pharmacy',   priority: 6 },
  { pattern: 'DR |MD |MEDICAL|CLINIC|HOSPITAL', field: 'payee', category: 'doctor', priority: 6 },
  { pattern: 'AMAZON|TARGET|WALMART',   field: 'payee', category: 'online',     priority: 5 },
  { pattern: 'H&M|ZARA|GAP|NORDSTROM|MACY', field: 'payee', category: 'clothing', priority: 5 },
  { pattern: 'TRANSFER TO SAVINGS',     field: 'payee', category: 'savings_cat', priority: 9 },
]

// ── Transaction templates ──────────────────────────────────────────────────
// Each returns an array of tx objects for a given month offset

function checkingTxs(monthOffset, seq) {
  const d = (day) => iso(monthsAgo(monthOffset, day))
  const salary = rnd(4100, 4300)
  const txs = [
    { date: d(1),  amount:  salary,         payee: 'DIRECT DEPOSIT PAYROLL',    memo: 'Salary' },
    { date: d(2),  amount: -rnd(1800, 1900), payee: 'APARTMENT RENT PAYMENT',   memo: 'Monthly rent' },
    { date: d(5),  amount: -rnd(110, 160),   payee: 'CONSOLIDATED ELECTRIC',    memo: 'Electricity' },
    { date: d(7),  amount: -rnd(60, 80),     payee: 'XFINITY INTERNET',         memo: 'Internet bill' },
    { date: d(10), amount: -rnd(220, 280),   payee: 'TRANSFER TO SAVINGS',      memo: 'Monthly savings' },
    { date: d(12), amount: -rnd(40, 65),     payee: 'AT&T MOBILITY',            memo: 'Phone bill' },
    { date: d(15), amount: -rnd(50, 90),     payee: 'SHELL OIL',                memo: 'Gas' },
    { date: d(22), amount: -rnd(40, 80),     payee: 'SHELL OIL',                memo: 'Gas' },
    { date: d(18), amount: -rnd(20, 45),     payee: 'LYFT',                     memo: 'Rideshare' },
    { date: d(25), amount: -rnd(15, 40),     payee: 'STARBUCKS',                memo: 'Coffee' },
  ]
  return txs.map((t, i) => ({ ...t, fitid: fitid('CHK', seq + i) }))
}

function savingsTxs(monthOffset, seq) {
  const d = (day) => iso(monthsAgo(monthOffset, day))
  const txs = [
    { date: d(12), amount:  rnd(220, 280),   payee: 'TRANSFER FROM CHECKING',   memo: 'Monthly transfer' },
    { date: d(28), amount:  rnd(3, 8),       payee: 'INTEREST PAYMENT',         memo: 'Interest earned' },
  ]
  return txs.map((t, i) => ({ ...t, fitid: fitid('SAV', seq + i) }))
}

function creditTxs(monthOffset, seq) {
  const d = (day) => iso(monthsAgo(monthOffset, day))
  const txs = [
    { date: d(3),  amount: -rnd(100, 160),   payee: 'WHOLE FOODS MARKET',       memo: 'Groceries' },
    { date: d(6),  amount: -rnd(35, 65),     payee: 'CHIPOTLE',                 memo: 'Lunch' },
    { date: d(8),  amount: -rnd(15, 30),     payee: 'NETFLIX.COM',              memo: 'Streaming' },
    { date: d(9),  amount: -rnd(50, 85),     payee: 'TRADER JOES',              memo: 'Groceries' },
    { date: d(11), amount: -rnd(45, 90),     payee: 'PLANET FITNESS',           memo: 'Gym membership' },
    { date: d(14), amount: -rnd(25, 50),     payee: 'AMAZON.COM',               memo: 'Online shopping' },
    { date: d(16), amount: -rnd(12, 25),     payee: 'STARBUCKS',                memo: 'Coffee' },
    { date: d(20), amount: -rnd(60, 120),    payee: 'WHOLE FOODS MARKET',       memo: 'Groceries' },
    { date: d(21), amount: -rnd(9, 16),      payee: 'SPOTIFY USA',              memo: 'Music streaming' },
    { date: d(23), amount: -rnd(30, 70),     payee: 'PANDA EXPRESS',            memo: 'Dinner' },
    { date: d(26), amount: -rnd(20, 45),     payee: 'CVS PHARMACY',             memo: 'Pharmacy' },
    { date: d(28), amount: -rnd(50, 150),    payee: 'AMAZON.COM',               memo: 'Online shopping' },
  ]
  return txs.map((t, i) => ({ ...t, fitid: fitid('CC1', seq + i) }))
}

// Current-month OFX for the "import experience" — new txs + 3 duplicate FITIDs
function importOfxTxs() {
  const d = (day) => {
    const date = new Date()
    date.setDate(Math.min(day, daysInMonth(date.getFullYear(), date.getMonth() + 1)))
    return iso(date)
  }
  return [
    // 3 duplicates from month-1 (same fitids as creditTxs(1, ...))
    { fitid: fitid('CC1', 12 * 12 + 1), date: d(3),  amount: -rnd(100, 160), payee: 'WHOLE FOODS MARKET', memo: 'Groceries — DUPLICATE' },
    { fitid: fitid('CC1', 12 * 12 + 3), date: d(8),  amount: -rnd(15,  30),  payee: 'NETFLIX.COM',        memo: 'Streaming — DUPLICATE' },
    { fitid: fitid('CC1', 12 * 12 + 5), date: d(11), amount: -rnd(45,  90),  payee: 'PLANET FITNESS',     memo: 'Gym — DUPLICATE' },
    // 9 fresh transactions for current month
    { fitid: fitid('CC1', 99001), date: d(2),  amount: -rnd(90,  140), payee: 'TRADER JOES',          memo: 'Groceries' },
    { fitid: fitid('CC1', 99002), date: d(5),  amount: -rnd(25,  45),  payee: 'CHIPOTLE',             memo: 'Lunch' },
    { fitid: fitid('CC1', 99003), date: d(7),  amount: -rnd(15,  30),  payee: 'NETFLIX.COM',          memo: 'Streaming' },
    { fitid: fitid('CC1', 99004), date: d(10), amount: -rnd(40,  70),  payee: 'AMAZON.COM',           memo: 'Online shopping' },
    { fitid: fitid('CC1', 99005), date: d(13), amount: -rnd(12,  22),  payee: 'STARBUCKS',            memo: 'Coffee' },
    { fitid: fitid('CC1', 99006), date: d(15), amount: -rnd(45,  90),  payee: 'PLANET FITNESS',       memo: 'Gym membership' },
    { fitid: fitid('CC1', 99007), date: d(17), amount: -rnd(60,  110), payee: 'WHOLE FOODS MARKET',   memo: 'Groceries' },
    { fitid: fitid('CC1', 99008), date: d(19), amount: -rnd(30,  60),  payee: 'PANDA EXPRESS',        memo: 'Dinner' },
    { fitid: fitid('CC1', 99009), date: d(22), amount: -rnd(9,   16),  payee: 'SPOTIFY USA',          memo: 'Music' },
  ]
}

// ── OFX writer ─────────────────────────────────────────────────────────────

function toOfxDate(isoDate) {
  return isoDate.replace(/-/g, '') + '120000'
}

function writeOfx({ bankId, acctId, acctType, currency, txs, outPath }) {
  const isCredit = acctType === 'CREDITCARD'
  const acctBlock = isCredit
    ? `<CCACCTFROM>\n<ACCTID>${acctId}\n</CCACCTFROM>`
    : `<BANKACCTFROM>\n<BANKID>${bankId}\n<ACCTID>${acctId}\n<ACCTTYPE>${acctType}\n</BANKACCTFROM>`
  const msgTag   = isCredit ? 'CREDITCARDMSGSRSV1' : 'BANKMSGSRSV1'
  const stmtTag  = isCredit ? 'CCSTMTRS'           : 'STMTRS'
  const trnTag   = isCredit ? 'CCSTMTTRNRS'        : 'STMTTRNRS'

  const txLines = txs.map(t => `<STMTTRN>
<TRNTYPE>${t.amount > 0 ? 'CREDIT' : 'DEBIT'}
<DTPOSTED>${toOfxDate(t.date)}
<TRNAMT>${t.amount.toFixed(2)}
<FITID>${t.fitid}
<NAME>${t.payee}
<MEMO>${t.memo}
</STMTTRN>`).join('\n')

  const content = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<DTSERVER>${toOfxDate(iso(new Date()))}
<LANGUAGE>ENG
</SONRS>
</SIGNONMSGSRSV1>
<${msgTag}>
<${trnTag}>
<TRNUID>1001
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<${stmtTag}>
<CURDEF>${currency}
${acctBlock}
<BANKTRANLIST>
<DTSTART>${toOfxDate(iso(monthsAgo(18)))}
<DTEND>${toOfxDate(iso(new Date()))}
${txLines}
</BANKTRANLIST>
</${stmtTag}>
</${trnTag}>
</${msgTag}>
</OFX>`

  writeFileSync(outPath, content, 'utf8')
}

// ── Main export ─────────────────────────────────────────────────────────────

export async function createDemoPortfolio(filePath) {
  await initDb(filePath)
  const db = getDb()

  function insertAccount(name, type, currency) {
    const s = db.prepare('INSERT INTO accounts (name, currency, type) VALUES (?, ?, ?)')
    s.run([name, currency, type])
    s.free()
    const q = db.prepare('SELECT last_insert_rowid() AS id')
    q.step(); const { id } = q.getAsObject(); q.free()
    return id
  }

  function insertTx(accountId, tx) {
    const s = db.prepare(
      'INSERT OR IGNORE INTO transactions (account_id, fitid, date, amount, payee, memo, raw_type) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    s.run([accountId, tx.fitid, tx.date, tx.amount, tx.payee, tx.memo, tx.amount > 0 ? 'CREDIT' : 'DEBIT'])
    s.free()
    const q = db.prepare('SELECT last_insert_rowid() AS id')
    q.step(); const { id } = q.getAsObject(); q.free()
    return id
  }

  // Insert everything in one transaction for speed
  db.run('BEGIN')
  try {
    // ── Categories ──────────────────────────────────────────────────────────
    const catIds = {}
    for (const c of CATEGORIES) {
      const parentId = c.parent ? catIds[c.parent] : null
      const stmt = db.prepare('INSERT INTO categories (parent_id, name) VALUES (?, ?)')
      stmt.run([parentId, c.name])
      stmt.free()
      const id = db.prepare('SELECT last_insert_rowid() AS id')
      id.step()
      catIds[c.key] = id.getAsObject().id
      id.free()
    }

    // ── Rules ────────────────────────────────────────────────────────────────
    for (const r of RULES) {
      const stmt = db.prepare(
        'INSERT INTO rules (pattern, field, category_id, priority) VALUES (?, ?, ?, ?)'
      )
      stmt.run([r.pattern, r.field, catIds[r.category], r.priority])
      stmt.free()
    }

    // ── Accounts ─────────────────────────────────────────────────────────────
    const chkId = insertAccount('Chase Checking',     'checking', 'USD')
    const savId = insertAccount('Chase Savings',      'savings',  'USD')
    const cc1Id = insertAccount('Visa Credit Card',   'credit',   'USD')

    // ── Transactions (18 months) ──────────────────────────────────────────

    const chkTxIds = []
    const savTxIds = []

    for (let m = 17; m >= 1; m--) {
      const chkSeq = m * 20
      const savSeq = m * 5
      const cc1Seq = m * 12

      const chkBatch = checkingTxs(m, chkSeq)
      const savBatch = savingsTxs(m, savSeq)
      const cc1Batch = creditTxs(m, cc1Seq)

      for (const tx of chkBatch) chkTxIds.push({ month: m, id: insertTx(chkId, tx), tx })
      for (const tx of savBatch) savTxIds.push({ month: m, id: insertTx(savId, tx), tx })
      for (const tx of cc1Batch) insertTx(cc1Id, tx)
    }

    // ── Apply rules ───────────────────────────────────────────────────────
    const allRules = []
    const rStmt = db.prepare('SELECT id, pattern, field, category_id FROM rules ORDER BY priority DESC')
    while (rStmt.step()) allRules.push(rStmt.getAsObject())
    rStmt.free()

    const allTxs = []
    const tStmt = db.prepare('SELECT id, payee, memo FROM transactions WHERE category_id IS NULL')
    while (tStmt.step()) allTxs.push(tStmt.getAsObject())
    tStmt.free()

    for (const tx of allTxs) {
      for (const rule of allRules) {
        const haystack = (rule.field === 'payee' ? tx.payee : tx.memo) || ''
        let matched = false
        try { matched = new RegExp(rule.pattern, 'i').test(haystack) }
        catch { matched = haystack.toLowerCase().includes(rule.pattern.toLowerCase()) }
        if (matched) {
          const u = db.prepare('UPDATE transactions SET category_id = ? WHERE id = ?')
          u.run([rule.category_id, tx.id]); u.free()
          break
        }
      }
    }

    // ── Link transfers (checking outflow ↔ savings inflow, same month) ────
    for (const { month, id: chkTxId, tx: chkTx } of chkTxIds) {
      if (!chkTx.payee.includes('TRANSFER TO SAVINGS')) continue
      const savMatch = savTxIds.find(s =>
        s.month === month && s.tx.payee.includes('TRANSFER FROM CHECKING')
      )
      if (!savMatch) continue
      const u1 = db.prepare('UPDATE transactions SET is_transfer=1, transfer_pair_id=? WHERE id=?')
      u1.run([savMatch.id, chkTxId]); u1.free()
      const u2 = db.prepare('UPDATE transactions SET is_transfer=1, transfer_pair_id=? WHERE id=?')
      u2.run([chkTxId, savMatch.id]); u2.free()
    }

    // ── Budgets (current year, monthly) ───────────────────────────────────
    const curYear = new Date().getFullYear()
    const budgets = [
      { category: 'food',          amount: 600  },
      { category: 'housing',       amount: 2100 },
      { category: 'transport',     amount: 200  },
      { category: 'entertainment', amount: 100  },
      { category: 'healthcare',    amount: 150  },
      { category: 'shopping',      amount: 250  },
    ]
    for (let month = 1; month <= 12; month++) {
      for (const b of budgets) {
        const s = db.prepare(
          'INSERT INTO budgets (category_id, amount, period, year, month) VALUES (?, ?, ?, ?, ?)'
        )
        s.run([catIds[b.category], b.amount, 'monthly', curYear, month])
        s.free()
      }
    }

    db.run('COMMIT')
  } catch (e) {
    db.run('ROLLBACK')
    throw e
  }

  // Persist to disk
  const { writeFileSync: wfs } = await import('fs')
  const exported = getDb().export()
  wfs(filePath, Buffer.from(exported))

  // ── Write demo import OFX ──────────────────────────────────────────────
  const ofxPath = join(dirname(filePath), 'demo-import.ofx')
  writeOfx({
    bankId:   '411000124',
    acctId:   '4001234567',
    acctType: 'CREDITCARD',
    currency: 'USD',
    txs:      importOfxTxs(),
    outPath:  ofxPath,
  })

  return {
    accounts: ['Chase Checking', 'Chase Savings', 'Visa Credit Card'],
    ofxPath,
  }
}
