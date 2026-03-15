import { useState, useEffect, useCallback } from 'react'
import { useDrawer } from '../context/DrawerContext'

export default function CategoriesView() {
  const [tree, setTree] = useState([])
  const { openDrawer } = useDrawer()

  const load = useCallback(() => {
    window.api.getCategoryTree().then(setTree)
  }, [])

  useEffect(() => {
    load()
    window.addEventListener('vinance:categories:changed', load)
    return () => window.removeEventListener('vinance:categories:changed', load)
  }, [load])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Categories</h1>
        <button
          onClick={() => openDrawer('addCategory')}
          className="bg-blue-600 text-white rounded px-3 py-1.5 text-sm hover:bg-blue-700"
        >
          + Category
        </button>
      </div>

      {tree.length === 0 ? (
        <p className="text-gray-500 text-sm">No categories yet. Add one to start categorizing transactions.</p>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <ul className="divide-y">
            {tree.map(node => (
              <CategoryNode key={node.id} node={node} depth={0} onAddChild={openDrawer} onReload={load} />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function CategoryNode({ node, depth, onAddChild, onReload }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(node.name)

  async function handleRename(e) {
    e.preventDefault()
    if (!name.trim() || name.trim() === node.name) { setEditing(false); return }
    await window.api.renameCategory(node.id, name.trim())
    window.dispatchEvent(new CustomEvent('vinance:categories:changed'))
    setEditing(false)
    onReload()
  }

  return (
    <>
      <li
        className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-sm"
        style={{ paddingLeft: `${1 + depth * 1.5}rem` }}
      >
        {depth > 0 && <span className="text-gray-300 select-none">└</span>}

        {editing ? (
          <form onSubmit={handleRename} className="flex gap-2 flex-1">
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={() => { setName(node.name); setEditing(false) }}
              className="border rounded px-2 py-0.5 text-sm flex-1"
            />
            <button type="submit" className="text-blue-600 text-xs hover:underline">Save</button>
          </form>
        ) : (
          <>
            <span className="flex-1 font-medium">{node.name}</span>
            <span className="text-gray-400 text-xs">{node.path}</span>
            <button
              onClick={() => setEditing(true)}
              className="text-gray-400 hover:text-gray-700 text-xs ml-2"
            >
              Rename
            </button>
            <button
              onClick={() => onAddChild('addCategory', { parentId: node.id })}
              className="text-blue-500 hover:text-blue-700 text-xs"
            >
              + sub
            </button>
          </>
        )}
      </li>
      {node.children?.map(child => (
        <CategoryNode key={child.id} node={child} depth={depth + 1} onAddChild={onAddChild} onReload={onReload} />
      ))}
    </>
  )
}
