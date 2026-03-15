import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDrawer } from '../context/DrawerContext'

export default function AccountsView() {
  const [accounts, setAccounts] = useState([])
  const [importing, setImporting] = useState(null)
  const [renaming, setRenaming] = useState(null) // { id, name }
  const { openDrawer } = useDrawer()
  const navigate = useNavigate()

  const load = useCallback(() => {
    window.api.listAccounts().then(setAccounts)
  }, [])

  useEffect(() => { load() }, [load])

  // Reload when a new account is created via drawer
  useEffect(() => {
    window.addEventListener('vinance:accounts:changed', load)
    return () => window.removeEventListener('vinance:accounts:changed', load)
  }, [load])

  async function handleRename(id, name) {
    if (!name.trim()) return
    await window.api.renameAccount(id, name.trim())
    setRenaming(null)
    load()
  }

  async function handleImport(accountId = null) {
    const filePath = await window.api.openFileDialog()
    if (!filePath) return
    setImporting(accountId ?? 'new')
    try {
      const result = await window.api.importFile(filePath, accountId)
      alert(`Imported ${result.imported} transactions (${result.skipped} duplicates skipped).`)
      load()
    } catch (err) {
      alert(`Import failed: ${err.message}`)
    } finally {
      setImporting(null)
    }
  }

  // Total across all accounts — only meaningful if single currency, so show per-currency totals
  const totals = accounts.reduce((acc, a) => {
    acc[a.currency] = (acc[a.currency] || 0) + a.balance
    return acc
  }, {})

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Overview</h1>
        <div className="flex gap-2">
          <button
            onClick={() => openDrawer('addAccount', { onCreated: load })}
            className="border rounded px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            + Account
          </button>
          <button
            onClick={() => openDrawer('addCategory')}
            className="border rounded px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            + Category
          </button>
          <button
            onClick={() => handleImport(null)}
            disabled={importing === 'new'}
            className="bg-blue-600 text-white rounded px-3 py-1.5 text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {importing === 'new' ? 'Importing…' : 'Import OFX/QFX'}
          </button>
        </div>
      </div>

      {accounts.length === 0 ? (
        <p className="text-gray-500 text-sm">No accounts yet. Create one or import an OFX/QFX file to get started.</p>
      ) : (
        <div className="grid gap-3">
          {/* Total row */}
          <div className="bg-gray-50 rounded-lg border px-4 py-3 flex items-center">
            <span className="flex-1 text-sm font-medium text-gray-600">Total</span>
            <div className="flex gap-4">
              {Object.entries(totals).map(([currency, total]) => (
                <span key={currency} className={`text-lg font-bold tabular-nums ${total < 0 ? 'text-red-600' : 'text-green-700'}`}>
                  {formatCurrency(total, currency)}
                </span>
              ))}
            </div>
          </div>

          {accounts.map(acct => (
            <div key={acct.id} className="bg-white rounded-lg border p-4 flex items-center gap-4">
              <div className="flex-1">
                {renaming?.id === acct.id ? (
                  <form onSubmit={e => { e.preventDefault(); handleRename(acct.id, renaming.name) }}
                        className="flex gap-2 items-center">
                    <input
                      autoFocus
                      value={renaming.name}
                      onChange={e => setRenaming({ ...renaming, name: e.target.value })}
                      onBlur={() => handleRename(acct.id, renaming.name)}
                      onKeyDown={e => e.key === 'Escape' && setRenaming(null)}
                      className="border rounded px-2 py-0.5 text-sm font-medium w-48"
                    />
                  </form>
                ) : (
                  <div className="font-medium cursor-pointer hover:text-blue-600 group"
                       onClick={() => setRenaming({ id: acct.id, name: acct.name })}>
                    {acct.name}
                    <span className="ml-1 text-xs text-gray-400 opacity-0 group-hover:opacity-100">✎</span>
                  </div>
                )}
                <div className="text-xs text-gray-500 uppercase">{acct.type} · {acct.currency}</div>
              </div>
              <div className={`text-lg font-semibold tabular-nums ${acct.balance < 0 ? 'text-red-600' : 'text-green-700'}`}>
                {formatCurrency(acct.balance, acct.currency)}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => navigate(`/transactions?accountId=${acct.id}`)}
                  className="text-sm border rounded px-3 py-1.5 hover:bg-gray-50"
                >
                  Transactions
                </button>
                <button
                  onClick={() => handleImport(acct.id)}
                  disabled={importing === acct.id}
                  className="text-sm border rounded px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
                >
                  {importing === acct.id ? 'Importing…' : 'Import more'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
}
