import { contextBridge, ipcRenderer } from 'electron'

// Expose a safe, typed API to the renderer via window.api
contextBridge.exposeInMainWorld('api', {
  // Portfolios
  listPortfolios:    ()              => ipcRenderer.invoke('portfolio:list'),
  currentPortfolio:  ()              => ipcRenderer.invoke('portfolio:current'),
  createPortfolio:   (data)          => ipcRenderer.invoke('portfolio:create', data),
  openPortfolio:     (data)          => ipcRenderer.invoke('portfolio:open', data),
  switchPortfolio:   (data)          => ipcRenderer.invoke('portfolio:switch', data),
  setDefaultPortfolio: (data)        => ipcRenderer.invoke('portfolio:set-default', data),
  renamePortfolio:   (data)          => ipcRenderer.invoke('portfolio:rename', data),
  removePortfolio:   (data)          => ipcRenderer.invoke('portfolio:remove', data),
  createDemoPortfolio: (data)        => ipcRenderer.invoke('portfolio:create-demo', data),

  // Import
  openFileDialog:   ()             => ipcRenderer.invoke('import:open-file-dialog'),
  importFile:       (path, acctId) => ipcRenderer.invoke('import:parse-and-store', path, acctId),

  // Accounts
  listAccounts:     ()             => ipcRenderer.invoke('accounts:list'),
  createAccount:    (data)         => ipcRenderer.invoke('accounts:create', data),
  renameAccount:    (id, name)     => ipcRenderer.invoke('accounts:rename', id, name),
  deleteAccount:    (id)           => ipcRenderer.invoke('accounts:delete', id),

  // Transactions
  listTransactions: (opts)         => ipcRenderer.invoke('transactions:list', opts),
  setCategory:      (id, catId)    => ipcRenderer.invoke('transactions:set-category', id, catId),
  linkTransfer:        (id1, id2)  => ipcRenderer.invoke('transfers:link', id1, id2),
  unlinkTransfer:      (id)        => ipcRenderer.invoke('transfers:unlink', id),
  markPendingTransfer:  (id, acctId)=> ipcRenderer.invoke('transfers:mark-pending', id, acctId),
  createMirrorTransfer: (id, acctId)=> ipcRenderer.invoke('transfers:create-mirror', id, acctId),

  // Categories
  getCategoryTree:  ()             => ipcRenderer.invoke('categories:tree'),
  getCategoryFlat:  ()             => ipcRenderer.invoke('categories:flat'),
  createCategory:   (data)         => ipcRenderer.invoke('categories:create', data),
  renameCategory:   (id, name)     => ipcRenderer.invoke('categories:rename', id, name),

  // Rules
  listRules:        ()             => ipcRenderer.invoke('rules:list'),
  createRule:       (data)         => ipcRenderer.invoke('rules:create', data),
  updateRule:       (id, data)     => ipcRenderer.invoke('rules:update', id, data),
  deleteRule:       (id)           => ipcRenderer.invoke('rules:delete', id),
  applyAllRules:    ()             => ipcRenderer.invoke('rules:apply-all'),

  // Reports
  getReportSummary: (opts)         => ipcRenderer.invoke('reports:summary', opts),

  // Budgets
  listBudgets:      (opts)         => ipcRenderer.invoke('budgets:list', opts),
  upsertBudget:     (data)         => ipcRenderer.invoke('budgets:upsert', data),
  deleteBudget:     (id)           => ipcRenderer.invoke('budgets:delete', id),

  // Import history
  listImports:      (acctId)       => ipcRenderer.invoke('imports:list', acctId),
})
