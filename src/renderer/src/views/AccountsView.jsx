import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDrawer } from '../context/DrawerContext'

export default function AccountsView() {
  const [accounts, setAccounts] = useState([])
  const [importing, setImporting] = useState(null)
  const { openDrawer } = useDrawer()
  const navigate = useNavigate()

  const load = useCallback(() => {
    window.api.listAccounts().then(setAccounts)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleImport(accountId = null) {
    const filePath = await window.api.openFileDialog()
    if (!filePath) return
    setImporting(accountId ?? 'new')
    try {
      const result = await window.api.importFile(filePath, accountId)
      alert(`Imported ${result.imported} transactions (${result.skipped} duplicates skipped).`)
      load()
    } finally {
      setImporting(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Accounts</h1>
        <div className="flex gap-2">
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
        <p className="text-gray-500 text-sm">No accounts yet. Import an OFX/QFX file to get started.</p>
      ) : (
        <div className="grid gap-3">
          {accounts.map(acct => (
            <div key={acct.id} className="bg-white rounded-lg border p-4 flex items-center gap-4">
              <div className="flex-1">
                <div className="font-medium">{acct.name}</div>
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
