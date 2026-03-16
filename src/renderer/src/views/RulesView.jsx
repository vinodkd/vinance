import { useState, useEffect, useCallback } from 'react'
import { useDrawer } from '../context/DrawerContext'

export default function RulesView() {
  const [rules, setRules] = useState([])
  const [applying, setApplying] = useState(false)
  const { openDrawer } = useDrawer()

  const load = useCallback(() => {
    window.api.listRules().then(setRules)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleDelete(id) {
    await window.api.deleteRule(id)
    load()
  }

  async function handleApplyAll() {
    setApplying(true)
    try {
      const count = await window.api.applyAllRules()
      alert(`Categorized ${count} transactions.`)
      load()
    } finally {
      setApplying(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Categorization Rules</h1>
        <div className="flex gap-2">
          <button
            onClick={() => openDrawer('addCategory')}
            className="border rounded px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            + Category
          </button>
          <button
            onClick={handleApplyAll}
            disabled={applying}
            className="border rounded px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {applying ? 'Applying…' : 'Re-apply all rules'}
          </button>
          <button
            onClick={() => { openDrawer('addRule'); window.addEventListener('drawerclose', load, { once: true }) }}
            className="bg-blue-600 text-white rounded px-3 py-1.5 text-sm hover:bg-blue-700"
          >
            + Rule
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Pattern</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Field</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Category</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600 w-20">Priority</th>
              <th className="px-4 py-2 w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rules.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-mono">{r.pattern}</td>
                <td className="px-4 py-2 text-gray-500">{r.field}</td>
                <td className="px-4 py-2">{r.category_path}</td>
                <td className="px-4 py-2 text-gray-500 tabular-nums">{r.priority}</td>
                <td className="px-4 py-2 flex gap-3">
                  <button
                    onClick={() => { openDrawer('addRule', { ...r, onCreated: load }) }}
                    className="text-blue-400 hover:text-blue-600 text-xs"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="text-red-400 hover:text-red-600 text-xs"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No rules yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
