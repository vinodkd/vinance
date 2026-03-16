import { useState, useEffect } from 'react'

export default function AddCategoryDrawer({ data, onClose }) {
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState(data?.parentId ?? '')
  const [categories, setCategories] = useState([])

  useEffect(() => {
    window.api.getCategoryFlat().then(setCategories)
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    await window.api.createCategory({ name: name.trim(), parentId: parentId || null })
    window.dispatchEvent(new CustomEvent('vinance:categories:changed'))
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Add Category</h2>

      <label className="flex flex-col gap-1 text-sm">
        Name
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          className="border rounded px-3 py-2"
          placeholder="e.g. Groceries"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Parent (optional)
        <select
          value={parentId}
          onChange={e => setParentId(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="">— None (top-level) —</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.path}</option>
          ))}
        </select>
      </label>

      <div className="flex gap-2 mt-auto">
        <button type="submit" className="flex-1 bg-blue-600 text-white rounded py-2 text-sm font-medium hover:bg-blue-700">
          Create
        </button>
        <button type="button" onClick={onClose} className="flex-1 border rounded py-2 text-sm hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </form>
  )
}
