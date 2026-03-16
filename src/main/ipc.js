import { ipcMain, dialog, BrowserWindow } from 'electron'
import { readFileSync, existsSync } from 'fs'
import { basename, join } from 'path'
import { homedir } from 'os'
import { parse as parseOfx } from 'ofx-js'
import { accounts, transactions, categories, rules, imports, reports, budgets, initDb, getCurrentDbPath } from './db.js'
import { listPortfolios, addPortfolio, setDefault, removePortfolio, getPortfolioName, touchPortfolio } from './portfolios.js'

export function registerIpcHandlers() {

  // ── Portfolios ─────────────────────────────────────────────────────────────

  ipcMain.handle('portfolio:list', () => listPortfolios())

  ipcMain.handle('portfolio:current', () => {
    const path = getCurrentDbPath()
    if (!path) return null
    return { name: getPortfolioName(path) ?? basename(path, '.vinance'), path }
  })

  ipcMain.handle('portfolio:create', async (_event, { name }) => {
    const win = BrowserWindow.getFocusedWindow()
    const { filePath, canceled } = await dialog.showSaveDialog(win, {
      title: 'Create Portfolio',
      defaultPath: join(homedir(), `${name}.vinance`),
      filters: [{ name: 'Vinance Portfolio', extensions: ['vinance'] }]
    })
    if (canceled || !filePath) return null
    await initDb(filePath)
    const entry = addPortfolio({ name, path: filePath })
    setDefault(filePath)
    return entry
  })

  ipcMain.handle('portfolio:open', async (_event, { path: givenPath } = {}) => {
    let filePath = givenPath
    if (!filePath) {
      const win = BrowserWindow.getFocusedWindow()
      const { filePaths, canceled } = await dialog.showOpenDialog(win, {
        title: 'Open Portfolio',
        filters: [{ name: 'Vinance Portfolio', extensions: ['vinance'] }],
        properties: ['openFile']
      })
      if (canceled || !filePaths.length) return null
      filePath = filePaths[0]
    }
    if (!existsSync(filePath)) throw new Error('File not found: ' + filePath)
    await initDb(filePath)
    const name = getPortfolioName(filePath) ?? basename(filePath, '.vinance')
    const entry = addPortfolio({ name, path: filePath })
    setDefault(filePath)
    return entry
  })

  ipcMain.handle('portfolio:switch', async (_event, { path: filePath }) => {
    if (!existsSync(filePath)) throw new Error('File not found: ' + filePath)
    await initDb(filePath)
    touchPortfolio(filePath)
    setDefault(filePath)
    return { name: getPortfolioName(filePath) ?? basename(filePath, '.vinance'), path: filePath }
  })

  ipcMain.handle('portfolio:set-default', (_event, { path }) => {
    setDefault(path)
  })

  ipcMain.handle('portfolio:rename', (_event, { path, name }) => {
    addPortfolio({ name, path })
  })

  ipcMain.handle('portfolio:remove', (_event, { path }) => {
    removePortfolio(path)
  })

  ipcMain.handle('portfolio:create-demo', async (_event, { path: filePath } = {}) => {
    if (!filePath) {
      const win = BrowserWindow.getFocusedWindow()
      const { filePath: chosen, canceled } = await dialog.showSaveDialog(win, {
        title: 'Save Demo Portfolio',
        defaultPath: join(homedir(), 'demo.vinance'),
        filters: [{ name: 'Vinance Portfolio', extensions: ['vinance'] }]
      })
      if (canceled || !chosen) return null
      filePath = chosen
    }
    const { createDemoPortfolio } = await import('./demo.js')
    const result = await createDemoPortfolio(filePath)
    const entry = addPortfolio({ name: 'Demo', path: filePath })
    setDefault(filePath)
    return { ...result, entry }
  })

  // ── Import ─────────────────────────────────────────────────────────────────

  ipcMain.handle('import:open-file-dialog', async (event) => {
    const win = event.sender.getOwnerBrowserWindow?.() || null
    const { filePaths, canceled } = await dialog.showOpenDialog(win, {
      filters: [{ name: 'OFX/QFX Files', extensions: ['ofx', 'qfx'] }],
      properties: ['openFile']
    })
    return canceled ? null : filePaths[0]
  })

  ipcMain.handle('import:parse-and-store', async (_event, filePath, accountId = null) => {
    const raw = readFileSync(filePath, 'utf8')
    const ofx = await parseOfx(raw)

    const stmtList =
      ofx?.OFX?.BANKMSGSRSV1?.STMTTRNRS?.STMTRS
        ? [ofx.OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS]
        : ofx?.OFX?.CREDITCARDMSGSRSV1?.CCSTMTTRNRS?.CCSTMTRS
        ? [ofx.OFX.CREDITCARDMSGSRSV1.CCSTMTTRNRS.CCSTMTRS]
        : []

    if (!stmtList.length) throw new Error('No statement data found in file')

    const stmt = stmtList[0]
    const currency = stmt.CURDEF || 'USD'
    const bankId   = stmt.BANKACCTFROM?.BANKID || ''
    const acctId   = stmt.BANKACCTFROM?.ACCTID || stmt.CCACCTFROM?.ACCTID || ''

    // Derive type implied by the OFX file
    const ofxType = stmt.CCACCTFROM ? 'credit' : 'checking'

    // Create or find account
    let account
    if (accountId) {
      account = accounts.getById(accountId)
      // Validate currency match
      if (account.currency !== currency) {
        throw new Error(
          `File currency (${currency}) does not match account currency (${account.currency}).`
        )
      }
      // Validate type match (credit vs non-credit)
      const accountIsCredit = account.type === 'credit'
      const fileIsCredit    = ofxType === 'credit'
      if (accountIsCredit !== fileIsCredit) {
        throw new Error(
          `File is a ${ofxType} statement but account type is ${account.type}.`
        )
      }
    } else {
      account = accounts.findByBankInfo(bankId, acctId)
      if (!account) {
        account = accounts.create({
          name: acctId ? `${bankId} ${acctId}`.trim() : basename(filePath),
          currency,
          type: ofxType
        })
      }
    }

    // Normalize transactions
    const rawTxList = stmt.BANKTRANLIST?.STMTTRN || []
    const txList = (Array.isArray(rawTxList) ? rawTxList : [rawTxList]).map(t => ({
      fitid:   t.FITID,
      date:    formatOfxDate(t.DTPOSTED),
      amount:  parseFloat(t.TRNAMT),
      payee:   t.NAME || t.PAYEE || null,
      memo:    t.MEMO || null,
      rawType: t.TRNTYPE || null
    }))

    const { imported, skipped } = transactions.insertMany(account.id, txList)

    // Auto-categorize newly imported transactions
    rules.applyAll()

    imports.log({
      accountId: account.id,
      filename: basename(filePath),
      txCount: imported,
      skippedCount: skipped
    })

    return { imported, skipped, accountId: account.id }
  })

  // ── Accounts ───────────────────────────────────────────────────────────────

  ipcMain.handle('accounts:list',   () => accounts.list())
  ipcMain.handle('accounts:create', (_e, data) => accounts.create(data))
  ipcMain.handle('accounts:rename',  (_e, id, name) => accounts.rename(id, name))
  ipcMain.handle('accounts:delete',  (_e, id) => accounts.delete(id))

  // ── Transactions ───────────────────────────────────────────────────────────

  ipcMain.handle('transactions:list',         (_e, opts) => transactions.list(opts))
  ipcMain.handle('transactions:set-category', (_e, id, categoryId) => transactions.setCategory(id, categoryId))
  ipcMain.handle('transfers:link',            (_e, id1, id2) => transactions.linkTransfer(id1, id2))
  ipcMain.handle('transfers:unlink',          (_e, id) => transactions.unlinkTransfer(id))

  // ── Categories ─────────────────────────────────────────────────────────────

  ipcMain.handle('categories:tree',   () => buildTree(categories.all()))
  ipcMain.handle('categories:flat',   () => categories.all())
  ipcMain.handle('categories:create', (_e, data) => ({ id: categories.create(data) }))
  ipcMain.handle('categories:rename', (_e, id, name) => categories.rename(id, name))

  // ── Rules ──────────────────────────────────────────────────────────────────

  ipcMain.handle('rules:list',      () => rules.list())
  ipcMain.handle('rules:create',    (_e, data) => rules.create(data))
  ipcMain.handle('rules:update',    (_e, id, data) => rules.update(id, data))
  ipcMain.handle('rules:delete',    (_e, id) => rules.delete(id))
  ipcMain.handle('rules:apply-all', () => rules.applyAll())

  // ── Reports ────────────────────────────────────────────────────────────────

  ipcMain.handle('reports:summary', (_e, opts) => reports.summary(opts))

  // ── Budgets ────────────────────────────────────────────────────────────────

  ipcMain.handle('budgets:list',   (_e, opts) => budgets.list(opts))
  ipcMain.handle('budgets:upsert', (_e, data) => budgets.upsert(data))
  ipcMain.handle('budgets:delete', (_e, id) => budgets.delete(id))

  // ── Imports history ────────────────────────────────────────────────────────

  ipcMain.handle('imports:list', (_e, accountId) => imports.list(accountId))
}

function formatOfxDate(raw) {
  if (!raw) return new Date().toISOString().slice(0, 10)
  const s = String(raw).slice(0, 8)
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

function buildTree(flat) {
  const map = {}
  const roots = []
  for (const c of flat) { map[c.id] = { ...c, children: [] } }
  for (const c of flat) {
    if (c.parent_id && map[c.parent_id]) map[c.parent_id].children.push(map[c.id])
    else roots.push(map[c.id])
  }
  return roots
}
