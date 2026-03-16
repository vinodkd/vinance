import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316']

const now = new Date()
const DEFAULT_FROM = '2000-01-01'
const DEFAULT_TO   = `${now.getFullYear()}-12-31`

export default function ReportsView() {
  const navigate = useNavigate()
  const [dateFrom, setDateFrom] = useState(DEFAULT_FROM)
  const [dateTo,   setDateTo]   = useState(DEFAULT_TO)
  const [summary,  setSummary]  = useState(null)
  const [drillPath, setDrillPath] = useState([])

  const load = useCallback(() => {
    window.api.getReportSummary({ dateFrom, dateTo, accountIds: [] }).then(setSummary)
  }, [dateFrom, dateTo])

  useEffect(() => { load() }, [load])
  // Reset drill when date range changes
  useEffect(() => { setDrillPath([]) }, [dateFrom, dateTo])

  function drillPeriod(period) {
    const [year, month] = period.split('-')
    const from = `${year}-${month}-01`
    const to   = new Date(year, Number(month), 0).toISOString().slice(0, 10)
    navigate(`/transactions?dateFrom=${from}&dateTo=${to}`)
  }

  const expenseCategories = useMemo(() =>
    (summary?.byCategory ?? [])
      .filter(c => c.expense < 0)
      .map(c => ({ ...c, expense: Math.abs(c.expense) }))
  , [summary])

  // Aggregate rows at current drill level
  const currentSlices = useMemo(() => {
    const prefix = drillPath.length ? drillPath.join('/') + '/' : ''
    const depth  = drillPath.length + 1
    const buckets = {}

    for (const c of expenseCategories) {
      const path = c.category_path || 'Uncategorized'
      if (drillPath.length > 0 && !path.startsWith(prefix)) continue
      const segments = path.split('/')
      if (segments.length < depth) continue
      const key   = segments.slice(0, depth).join('/')
      const label = segments[depth - 1]
      if (!buckets[key]) buckets[key] = { label, key, expense: 0, hasChildren: false, category_id: c.category_id }
      buckets[key].expense += c.expense
      if (segments.length > depth) buckets[key].hasChildren = true
    }
    return Object.values(buckets).sort((a, b) => b.expense - a.expense)
  }, [expenseCategories, drillPath])

  function handleSliceClick(slice) {
    if (slice.hasChildren) {
      setDrillPath(slice.key.split('/'))
    } else {
      navigate(`/transactions?categoryId=${slice.category_id}&dateFrom=${dateFrom}&dateTo=${dateTo}`)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Reports</h1>
        <div className="flex gap-2 text-sm items-center">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border rounded px-2 py-1.5" />
          <span className="text-gray-400">–</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border rounded px-2 py-1.5" />
          <Preset label="This year" from={`${now.getFullYear()}-01-01`} to={DEFAULT_TO} set={[setDateFrom, setDateTo]} />
          <Preset label="This month"
            from={`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`}
            to={new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().slice(0,10)}
            set={[setDateFrom, setDateTo]}
          />
        </div>
      </div>

      {summary && (
        <>
          {/* Totals */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Stat label="Income"  value={summary.income}  color="text-green-700" />
            <Stat label="Expense" value={summary.expense} color="text-red-600" />
            <Stat label="Net"     value={summary.income + summary.expense}
              color={summary.income + summary.expense >= 0 ? 'text-green-700' : 'text-red-600'} />
          </div>

          {/* Income vs Expense by period */}
          <section className="bg-white border rounded-lg p-4 mb-6">
            <h2 className="font-semibold mb-4">Income vs Expense by Month</h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={summary.byPeriod} onClick={d => d?.activeLabel && drillPeriod(d.activeLabel)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={v => fmtNum(v)} />
                <Legend />
                <Bar dataKey="income"  fill="#10b981" name="Income" />
                <Bar dataKey="expense" fill="#ef4444" name="Expense" />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-400 mt-1">Click a bar group to see transactions for that month.</p>
          </section>

          {/* Category breakdown */}
          <div className="grid grid-cols-2 gap-6">
            <section className="bg-white border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">Expense by Category</h2>
                {/* Breadcrumb */}
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <button onClick={() => setDrillPath([])}
                    className={`hover:text-blue-600 ${drillPath.length === 0 ? 'font-semibold text-gray-800' : ''}`}>
                    All
                  </button>
                  {drillPath.map((seg, i) => (
                    <span key={i} className="flex items-center gap-1">
                      <span className="text-gray-300">›</span>
                      <button
                        onClick={() => setDrillPath(drillPath.slice(0, i + 1))}
                        className={`hover:text-blue-600 ${i === drillPath.length - 1 ? 'font-semibold text-gray-800' : ''}`}>
                        {seg}
                      </button>
                    </span>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={currentSlices}
                    dataKey="expense"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    onClick={handleSliceClick}
                    style={{ cursor: 'pointer' }}
                  >
                    {currentSlices.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, _, { payload }) =>
                    [`${fmtNum(v)}${payload.hasChildren ? ' (click to expand)' : ''}`, payload.label]
                  } />
                </PieChart>
              </ResponsiveContainer>
              <p className="text-xs text-gray-400 mt-1">
                Click a slice to {drillPath.length > 0 ? 'drill in or ' : ''}see transactions.
              </p>
            </section>

            <section className="bg-white border rounded-lg p-4">
              <h2 className="font-semibold mb-3">Category Breakdown</h2>
              <div className="overflow-y-auto max-h-72">
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-500 uppercase border-b">
                    <tr>
                      <th className="text-left py-1">Category</th>
                      <th className="text-right py-1">Expense</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {currentSlices.map((c, i) => (
                      <tr key={c.key} className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleSliceClick(c)}>
                        <td className="py-1.5 flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ background: COLORS[i % COLORS.length] }} />
                          {c.label}
                          {c.hasChildren && <span className="text-gray-400 text-xs">›</span>}
                        </td>
                        <td className="py-1.5 text-right tabular-nums text-red-600">{fmtNum(c.expense)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="text-xs text-gray-500 uppercase mb-1">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${color}`}>{fmtNum(Math.abs(value))}</div>
    </div>
  )
}

function Preset({ label, from, to, set: [setFrom, setTo] }) {
  return (
    <button onClick={() => { setFrom(from); setTo(to) }} className="border rounded px-2 py-1.5 hover:bg-gray-50">
      {label}
    </button>
  )
}

function fmtNum(v) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
}
