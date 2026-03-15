import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell
} from 'recharts'

const now = new Date()

export default function BudgetsView() {
  const [year,     setYear]     = useState(now.getFullYear())
  const [month,    setMonth]    = useState(now.getMonth() + 1)
  const [period,   setPeriod]   = useState('monthly')
  const [budgets,  setBudgets]  = useState([])
  const [categories, setCategories] = useState([])
  const [newEntry, setNewEntry] = useState({ categoryId: '', amount: '', period: 'monthly' })
  const navigate = useNavigate()

  const load = useCallback(() => {
    const opts = period === 'monthly' ? { year, month } : { year }
    window.api.listBudgets(opts).then(setBudgets)
  }, [year, month, period])

  useEffect(() => { load() }, [load])
  useEffect(() => { window.api.getCategoryFlat().then(setCategories) }, [])

  async function handleAdd(e) {
    e.preventDefault()
    if (!newEntry.categoryId || !newEntry.amount) return
    await window.api.upsertBudget({
      categoryId: Number(newEntry.categoryId),
      amount: Number(newEntry.amount),
      period: newEntry.period,
      year,
      month: newEntry.period === 'monthly' ? month : null
    })
    setNewEntry({ categoryId: '', amount: '', period: 'monthly' })
    load()
  }

  async function handleAmountChange(b, amount) {
    await window.api.upsertBudget({
      categoryId: b.category_id,
      amount: Number(amount),
      period: b.period,
      year: b.year,
      month: b.month
    })
    load()
  }

  async function handleDelete(id) {
    await window.api.deleteBudget(id)
    load()
  }

  function drillBudget(b) {
    const from = period === 'monthly'
      ? `${year}-${String(month).padStart(2,'0')}-01`
      : `${year}-01-01`
    const to = period === 'monthly'
      ? new Date(year, month, 0).toISOString().slice(0, 10)
      : `${year}-12-31`
    navigate(`/transactions?categoryId=${b.category_id}&dateFrom=${from}&dateTo=${to}`)
  }

  const chartData = budgets.map(b => ({
    name: b.category_path,
    budget: b.amount,
    actual: b.actual,
    variance: b.actual - b.amount,
    category_id: b.category_id
  }))

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">Budgets</h1>
        <select value={period} onChange={e => setPeriod(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))} className="border rounded px-2 py-1.5 text-sm">
          {[now.getFullYear()-1, now.getFullYear(), now.getFullYear()+1].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        {period === 'monthly' && (
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="border rounded px-2 py-1.5 text-sm">
            {Array.from({length:12},(_,i)=>i+1).map(m => (
              <option key={m} value={m}>{new Date(2000,m-1).toLocaleString('default',{month:'long'})}</option>
            ))}
          </select>
        )}
      </div>

      {/* Variance chart */}
      {chartData.length > 0 && (
        <section className="bg-white border rounded-lg p-4 mb-6">
          <h2 className="font-semibold mb-4">Budget vs Actual</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} onClick={d => d?.activePayload?.[0]?.payload && drillBudget(d.activePayload[0].payload)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <ReferenceLine y={0} stroke="#000" />
              <Bar dataKey="budget" name="Budget" fill="#94a3b8" />
              <Bar dataKey="actual"  name="Actual"  style={{ cursor: 'pointer' }}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.actual > d.budget ? '#ef4444' : '#10b981'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-400 mt-1">Click a bar to see matching transactions. Green = under budget, red = over.</p>
        </section>
      )}

      {/* Budget table */}
      <div className="bg-white border rounded-lg overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Category</th>
              <th className="text-right px-4 py-2 font-medium text-gray-600">Budget</th>
              <th className="text-right px-4 py-2 font-medium text-gray-600">Actual</th>
              <th className="text-right px-4 py-2 font-medium text-gray-600">Variance</th>
              <th className="px-4 py-2 w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {budgets.map(b => {
              const variance = b.actual - b.amount
              return (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 cursor-pointer hover:underline" onClick={() => drillBudget(b)}>
                    {b.category_path}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <input
                      type="number"
                      defaultValue={b.amount}
                      onBlur={e => handleAmountChange(b, e.target.value)}
                      className="w-24 text-right border rounded px-2 py-0.5 tabular-nums"
                    />
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmtNum(b.actual)}</td>
                  <td className={`px-4 py-2 text-right tabular-nums font-medium ${variance > 0 ? 'text-red-600' : 'text-green-700'}`}>
                    {variance > 0 ? '+' : ''}{fmtNum(variance)}
                  </td>
                  <td className="px-4 py-2">
                    <button onClick={() => handleDelete(b.id)} className="text-red-400 hover:text-red-600 text-xs">Delete</button>
                  </td>
                </tr>
              )
            })}
            {budgets.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No budgets set for this period.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add budget form */}
      <section className="bg-white border rounded-lg p-4">
        <h2 className="font-semibold mb-3">Add Budget</h2>
        <form onSubmit={handleAdd} className="flex flex-wrap gap-2 items-end text-sm">
          <label className="flex flex-col gap-1">
            Category
            <select
              value={newEntry.categoryId}
              onChange={e => setNewEntry(n => ({ ...n, categoryId: e.target.value }))}
              className="border rounded px-2 py-1.5"
            >
              <option value="">— Select —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.path}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            Amount
            <input
              type="number"
              value={newEntry.amount}
              onChange={e => setNewEntry(n => ({ ...n, amount: e.target.value }))}
              className="border rounded px-2 py-1.5 w-28"
              placeholder="0.00"
            />
          </label>
          <label className="flex flex-col gap-1">
            Period
            <select
              value={newEntry.period}
              onChange={e => setNewEntry(n => ({ ...n, period: e.target.value }))}
              className="border rounded px-2 py-1.5"
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </label>
          <button type="submit" className="bg-blue-600 text-white rounded px-4 py-1.5 hover:bg-blue-700">
            Add
          </button>
        </form>
      </section>
    </div>
  )
}

function fmtNum(v) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
}
