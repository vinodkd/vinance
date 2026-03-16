import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useDrawer } from '../context/DrawerContext'

const PAGE_SIZE = 50

export default function TransactionsView() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [data, setData] = useState({ rows: [], total: 0 })
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const { openDrawer } = useDrawer()

  const accountId  = searchParams.get('accountId') || ''
  const categoryId = searchParams.get('categoryId') || ''
  const dateFrom   = searchParams.get('dateFrom') || ''
  const dateTo     = searchParams.get('dateTo') || ''
  const page       = Number(searchParams.get('page') || 1)

  const load = useCallback(() => {
    window.api.listTransactions({
      accountId:  accountId  ? Number(accountId)  : undefined,
      categoryId: categoryId ? Number(categoryId) : undefined,
      dateFrom:   dateFrom || undefined,
      dateTo:     dateTo   || undefined,
      page,
      limit: PAGE_SIZE
    }).then(setData)
  }, [accountId, categoryId, dateFrom, dateTo, page])

  useEffect(() => { load() }, [load])

  function loadCategories() {
    window.api.getCategoryFlat().then(setCategories)
  }

  useEffect(() => {
    window.api.listAccounts().then(setAccounts)
    loadCategories()
    window.addEventListener('vinance:categories:changed', loadCategories)
    return () => window.removeEventListener('vinance:categories:changed', loadCategories)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])


  function setParam(key, value) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('page')
    setSearchParams(next)
  }

  async function handleCategoryChange(txId, catId) {
    await window.api.setCategory(txId, catId || null)
    load()
  }

  const totalPages = Math.ceil(data.total / PAGE_SIZE)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <button
          onClick={() => openDrawer('addCategory')}
          className="border rounded px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          + Category
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4 text-sm">
        <select value={accountId} onChange={e => setParam('accountId', e.target.value)} className="border rounded px-2 py-1.5">
          <option value="">All accounts</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={categoryId} onChange={e => setParam('categoryId', e.target.value)} className="border rounded px-2 py-1.5">
          <option value="">All categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.path}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setParam('dateFrom', e.target.value)} className="border rounded px-2 py-1.5" />
        <span className="self-center text-gray-400">–</span>
        <input type="date" value={dateTo} onChange={e => setParam('dateTo', e.target.value)} className="border rounded px-2 py-1.5" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-gray-600 w-28">Date</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Payee</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Memo</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Category</th>
              <th className="text-right px-4 py-2 font-medium text-gray-600 w-32">Amount</th>
              <th className="px-4 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.rows.map(tx => (
              <tr key={tx.id} className={`hover:bg-gray-50 ${tx.is_transfer ? 'opacity-50' : ''}`}>
                <td className="px-4 py-2 text-gray-500 tabular-nums">{tx.date}</td>
                <td className="px-4 py-2 font-medium">{tx.payee || '—'}</td>
                <td className="px-4 py-2 text-gray-500">{tx.memo || ''}</td>
                <td className="px-4 py-2">
                  {tx.is_transfer ? (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Transfer</span>
                  ) : (
                    <select
                      value={tx.category_id || ''}
                      onChange={e => handleCategoryChange(tx.id, e.target.value)}
                      className="text-sm border-0 bg-transparent focus:ring-1 focus:ring-blue-300 rounded"
                    >
                      <option value="">Uncategorized</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.path}</option>)}
                    </select>
                  )}
                </td>
                <td className={`px-4 py-2 text-right tabular-nums font-medium ${tx.amount < 0 ? 'text-red-600' : 'text-green-700'}`}>
                  {formatCurrency(tx.amount, tx.currency)}
                </td>
                <td className="px-4 py-2 whitespace-nowrap flex gap-2">
                  {!tx.is_transfer && (
                    <>
                      <button
                        onClick={() => openDrawer('addRule', {
                          prefill: tx.payee || tx.memo || '',
                          onCreated: load
                        })}
                        className="text-xs text-blue-500 hover:text-blue-700 hover:underline"
                      >
                        + rule
                      </button>
                      <button
                        onClick={() => openDrawer('transferMatcher', { tx, onLinked: load })}
                        className="text-xs text-purple-500 hover:text-purple-700 hover:underline"
                      >
                        ⇄ transfer
                      </button>
                    </>
                  )}
                  {tx.is_transfer && (
                    <button
                      onClick={async () => { await window.api.unlinkTransfer(tx.id); load() }}
                      className="text-xs text-gray-400 hover:text-red-500 hover:underline"
                    >
                      unlink
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {data.rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No transactions found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <span>{data.total} transactions</span>
          <div className="flex gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setParam('page', page - 1)}
              className="border rounded px-3 py-1 disabled:opacity-40 hover:bg-gray-50"
            >
              ← Prev
            </button>
            <span className="px-3 py-1">Page {page} of {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setParam('page', page + 1)}
              className="border rounded px-3 py-1 disabled:opacity-40 hover:bg-gray-50"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
}
