import { useState } from 'react'

export default function AddGroupDrawer({ data, onClose }) {
  const [name, setName] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    await window.api.createGroup(name.trim())
    window.dispatchEvent(new CustomEvent('vinance:accounts:changed'))
    data?.onCreated?.()
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Add Account Group</h2>
      <label className="flex flex-col gap-1 text-sm">
        Name
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Banking, Credit Cards"
          className="border rounded px-3 py-2"
        />
      </label>
      <div className="flex gap-2 mt-auto">
        <button type="submit" className="flex-1 bg-blue-600 text-white rounded py-2 text-sm font-medium hover:bg-blue-700">
          Create group
        </button>
        <button type="button" onClick={onClose} className="flex-1 border rounded py-2 text-sm hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </form>
  )
}
