import { useState, useEffect } from 'react'

export default function SwitchPortfolioDrawer({ onClose }) {
  const [portfolios, setPortfolios]   = useState([])
  const [current, setCurrent]         = useState(null)
  const [defaultPath, setDefaultPath] = useState(null)
  const [creating, setCreating]       = useState(false)
  const [newName, setNewName]         = useState('')
  const [error, setError]             = useState('')

  useEffect(() => {
    Promise.all([
      window.api.listPortfolios(),
      window.api.currentPortfolio()
    ]).then(([{ portfolios, default: def }, cur]) => {
      setPortfolios(portfolios.sort((a, b) => b.lastOpened?.localeCompare(a.lastOpened ?? '') ?? 0))
      setDefaultPath(def)
      setCurrent(cur)
    })
  }, [])

  async function handleSwitch(path) {
    if (path === current?.path) { onClose(); return }
    setError('')
    try {
      await window.api.switchPortfolio({ path })
      window.location.reload()
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!newName.trim()) return
    setError('')
    try {
      const result = await window.api.createPortfolio({ name: newName.trim() })
      if (result) window.location.reload()
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleOpen() {
    setError('')
    try {
      const result = await window.api.openPortfolio()
      if (result) window.location.reload()
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleSetDefault(e, path) {
    e.stopPropagation()
    await window.api.setDefaultPortfolio({ path })
    setDefaultPath(path)
  }

  async function handleRemove(e, path) {
    e.stopPropagation()
    if (path === current?.path) { setError("Can't remove the currently open portfolio."); return }
    await window.api.removePortfolio({ path })
    setPortfolios(ps => ps.filter(p => p.path !== path))
    if (defaultPath === path) setDefaultPath(null)
  }

  return (
    <div className="p-6 flex flex-col gap-4 h-full">
      <h2 className="text-lg font-semibold">Portfolios</h2>

      <div className="flex-1 overflow-y-auto">
        {portfolios.length === 0 ? (
          <p className="text-sm text-gray-400">No portfolios yet.</p>
        ) : (
          <ul className="divide-y border rounded-lg bg-white">
            {portfolios.map(p => (
              <li key={p.path}>
                <button
                  onClick={() => handleSwitch(p.path)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 flex items-start gap-2 ${p.path === current?.path ? 'bg-blue-50' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm flex items-center gap-1.5 flex-wrap">
                      {p.name}
                      {p.path === current?.path && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">open</span>
                      )}
                      {p.path === defaultPath && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">default</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 truncate mt-0.5">{p.path}</div>
                  </div>
                  <div className="flex gap-2 shrink-0 mt-0.5" onClick={e => e.stopPropagation()}>
                    {p.path !== defaultPath && (
                      <button onClick={e => handleSetDefault(e, p.path)}
                        className="text-xs text-gray-400 hover:text-gray-700">
                        Set default
                      </button>
                    )}
                    {p.path !== current?.path && (
                      <button onClick={e => handleRemove(e, p.path)}
                        className="text-xs text-red-400 hover:text-red-600">
                        Remove
                      </button>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-col gap-2 pt-2 border-t">
        {creating ? (
          <form onSubmit={handleCreate} className="flex flex-col gap-2">
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Portfolio name"
              className="border rounded px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-blue-600 text-white rounded py-2 text-sm font-medium hover:bg-blue-700">
                Choose location…
              </button>
              <button type="button" onClick={() => { setCreating(false); setNewName('') }}
                className="flex-1 border rounded py-2 text-sm hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button onClick={() => setCreating(true)}
            className="bg-blue-600 text-white rounded py-2 text-sm font-medium hover:bg-blue-700">
            + New portfolio
          </button>
        )}
        <button onClick={handleOpen}
          className="border rounded py-2 text-sm hover:bg-gray-50">
          Open existing portfolio…
        </button>
      </div>
    </div>
  )
}
