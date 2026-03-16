import { useState, useEffect } from 'react'

export default function TransferMatcherDrawer({ data, onClose }) {
  const { tx, onLinked } = data
  const [accounts,   setAccounts]   = useState([])
  const [targetAcct, setTargetAcct] = useState('')
  const [match,      setMatch]      = useState(null)   // best candidate
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')

  useEffect(() => {
    window.api.listAccounts().then(accts =>
      setAccounts(accts.filter(a => a.id !== tx.account_id))
    )
  }, [tx.account_id])

  useEffect(() => {
    if (!targetAcct) { setMatch(null); return }
    setLoading(true)
    setMatch(null)
    setError('')
    window.api.listTransactions({ accountId: Number(targetAcct), limit: 200 })
      .then(({ rows }) => {
        const candidates = rows.filter(r => !r.is_transfer)
        if (!candidates.length) { setError('No unlinked transactions in that account.'); return }
        // Best match: closest absolute amount, then closest date
        const best = candidates.reduce((best, c) => {
          const amtDiff  = Math.abs(Math.abs(c.amount) - Math.abs(tx.amount))
          const dateDiff = Math.abs(new Date(c.date) - new Date(tx.date))
          const bAmtDiff = Math.abs(Math.abs(best.amount) - Math.abs(tx.amount))
          const bDateDiff = Math.abs(new Date(best.date) - new Date(tx.date))
          // Primary sort: amount proximity; secondary: date proximity
          if (amtDiff < bAmtDiff) return c
          if (amtDiff === bAmtDiff && dateDiff < bDateDiff) return c
          return best
        })
        setMatch(best)
      })
      .catch(() => setError('Could not load transactions.'))
      .finally(() => setLoading(false))
  }, [targetAcct, tx])

  async function handleConfirm() {
    await window.api.linkTransfer(tx.id, match.id)
    onLinked?.()
    onClose()
  }

  async function handleMarkPending() {
    await window.api.markPendingTransfer(tx.id, Number(targetAcct))
    onLinked?.()
    onClose()
  }

  return (
    <div className="p-6 flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Mark as Transfer</h2>

      {/* Source transaction */}
      <div className="bg-gray-50 border rounded p-3 text-sm">
        <div className="text-xs text-gray-500 uppercase mb-1">This transaction</div>
        <div className="font-medium">{tx.payee || tx.memo || '—'}</div>
        <div className="text-gray-500">{tx.date}</div>
        <div className={`font-semibold tabular-nums ${tx.amount < 0 ? 'text-red-600' : 'text-green-700'}`}>
          {fmtAmt(tx.amount, tx.currency)}
        </div>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Other account
        <select
          value={targetAcct}
          onChange={e => setTargetAcct(e.target.value)}
          className="border rounded px-3 py-2"
          autoFocus
        >
          <option value="">— Select account —</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </label>

      {loading && <p className="text-sm text-gray-400">Finding best match…</p>}
      {error   && <p className="text-sm text-red-500">{error}</p>}

      {match && (
        <div className="border rounded p-3 text-sm bg-white">
          <div className="text-xs text-gray-500 uppercase mb-1">Best match found</div>
          <div className="font-medium">{match.payee || match.memo || '—'}</div>
          <div className="text-gray-500">{match.date}</div>
          <div className={`font-semibold tabular-nums ${match.amount < 0 ? 'text-red-600' : 'text-green-700'}`}>
            {fmtAmt(match.amount, match.currency)}
          </div>
        </div>
      )}

      {targetAcct && !loading && (
        <div className="flex flex-col gap-2">
          {match && (
            <button
              onClick={handleConfirm}
              className="bg-blue-600 text-white rounded py-2 text-sm font-medium hover:bg-blue-700"
            >
              Confirm link
            </button>
          )}
          <button
            onClick={handleMarkPending}
            className="border border-amber-400 text-amber-700 rounded py-2 text-sm hover:bg-amber-50"
          >
            {match ? 'Mark as pending instead (reconcile on next import)' : 'No match yet — mark as pending transfer'}
          </button>
          <button onClick={onClose} className="border rounded py-2 text-sm hover:bg-gray-50">Cancel</button>
        </div>
      )}

      {!targetAcct && (
        <button onClick={onClose} className="border rounded py-2 text-sm hover:bg-gray-50">Cancel</button>
      )}
    </div>
  )
}

function fmtAmt(amount, currency = 'USD') {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
}
