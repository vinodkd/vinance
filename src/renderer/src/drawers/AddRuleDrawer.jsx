import { useState, useEffect, useRef } from 'react'

export default function AddRuleDrawer({ data, onClose }) {
  const editing = !!data?.id
  const [pattern, setPattern]     = useState(data?.pattern || data?.prefill || '')
  const [field, setField]         = useState(data?.field || 'memo')
  const [categoryId, setCategory] = useState(data?.category_id ? String(data.category_id) : '')
  const [priority, setPriority]   = useState(data?.priority ?? 0)
  const [categories, setCategories] = useState([])

  const [addingCat, setAddingCat]   = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatParent, setNewCatParent] = useState('')
  const newCatInputRef = useRef(null)

  const loadCategories = () => window.api.getCategoryFlat().then(setCategories)

  useEffect(() => {
    loadCategories()
    window.addEventListener('vinance:categories:changed', loadCategories)
    return () => window.removeEventListener('vinance:categories:changed', loadCategories)
  }, [])

  useEffect(() => {
    if (addingCat) {
      const t = setTimeout(() => newCatInputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [addingCat])

  async function handleCreateCategory(e) {
    e.preventDefault()
    if (!newCatName.trim()) return
    await window.api.createCategory({
      name: newCatName.trim(),
      parentId: newCatParent || null
    })
    window.dispatchEvent(new CustomEvent('vinance:categories:changed'))
    // Reload and auto-select the new category
    const updated = await window.api.getCategoryFlat()
    setCategories(updated)
    const created = updated.find(c =>
      c.path === (newCatParent
        ? updated.find(p => String(p.id) === String(newCatParent))?.path + '/' + newCatName.trim()
        : newCatName.trim())
    )
    if (created) setCategory(String(created.id))
    setNewCatName('')
    setNewCatParent('')
    setAddingCat(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!pattern.trim() || !categoryId) return
    if (editing) {
      await window.api.updateRule(data.id, { pattern: pattern.trim(), field, categoryId: Number(categoryId), priority: Number(priority) })
    } else {
      await window.api.createRule({ pattern: pattern.trim(), field, categoryId: Number(categoryId), priority: Number(priority) })
    }
    await window.api.applyAllRules()
    data?.onCreated?.()
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{editing ? 'Edit Rule' : 'Add Categorization Rule'}</h2>

      <label className="flex flex-col gap-1 text-sm">
        Match field
        <select value={field} onChange={e => setField(e.target.value)} className="border rounded px-3 py-2">
          <option value="payee">Payee</option>
          <option value="memo">Memo</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Pattern (substring or regex)
        <input
          value={pattern}
          onChange={e => setPattern(e.target.value)}
          className="border rounded px-3 py-2 font-mono"
          placeholder="e.g. WHOLE FOODS"
        />
      </label>

      <div className="flex flex-col gap-1 text-sm">
        <div className="flex items-center justify-between">
          <span>Category</span>
          {!addingCat && (
            <button
              type="button"
              onClick={() => setAddingCat(true)}
              className="text-blue-500 hover:text-blue-700 text-xs hover:underline"
            >
              + New category
            </button>
          )}
        </div>

        <select value={categoryId} onChange={e => setCategory(e.target.value)} className="border rounded px-3 py-2">
          <option value="">— Select category —</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.path}</option>
          ))}
        </select>

        {addingCat && (
          <div className="border rounded p-3 bg-gray-50 flex flex-col gap-2 mt-1">
            <span className="text-xs font-medium text-gray-600">New category</span>
            <input
              ref={newCatInputRef}
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              placeholder="Category name"
              className="border rounded px-2 py-1.5 text-sm"
            />
            <select
              value={newCatParent}
              onChange={e => setNewCatParent(e.target.value)}
              className="border rounded px-2 py-1.5 text-sm"
            >
              <option value="">— No parent (top-level) —</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.path}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCreateCategory}
                className="flex-1 bg-blue-600 text-white rounded py-1.5 text-xs font-medium hover:bg-blue-700"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => { setAddingCat(false); setNewCatName(''); setNewCatParent('') }}
                className="flex-1 border rounded py-1.5 text-xs hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Priority (higher = applied first)
        <input
          type="number"
          value={priority}
          onChange={e => setPriority(e.target.value)}
          className="border rounded px-3 py-2"
        />
      </label>

      <div className="flex gap-2 mt-auto">
        <button type="submit" className="flex-1 bg-blue-600 text-white rounded py-2 text-sm font-medium hover:bg-blue-700">
          {editing ? 'Save changes' : 'Create rule'}
        </button>
        <button type="button" onClick={onClose} className="flex-1 border rounded py-2 text-sm hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </form>
  )
}
