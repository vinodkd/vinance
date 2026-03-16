import { useState } from 'react'

const TYPES = ['checking', 'savings', 'credit']
const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'INR']

export default function AddAccountDrawer({ onClose }) {
  const [name, setName]         = useState('')
  const [type, setType]         = useState('checking')
  const [currency, setCurrency] = useState('USD')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    await window.api.createAccount({ name: name.trim(), type, currency })
    window.dispatchEvent(new CustomEvent('vinance:accounts:changed'))
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Add Account</h2>

      <label className="flex flex-col gap-1 text-sm">
        Name
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Chase Checking"
          className="border rounded px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Type
        <select value={type} onChange={e => setType(e.target.value)} className="border rounded px-3 py-2">
          {TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Currency
        <select value={currency} onChange={e => setCurrency(e.target.value)} className="border rounded px-3 py-2">
          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>

      <div className="flex gap-2 mt-auto">
        <button type="submit" className="flex-1 bg-blue-600 text-white rounded py-2 text-sm font-medium hover:bg-blue-700">
          Create account
        </button>
        <button type="button" onClick={onClose} className="flex-1 border rounded py-2 text-sm hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </form>
  )
}
