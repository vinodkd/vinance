import { useState, useEffect } from 'react'

export default function PortfolioPickerView({ onOpen }) {
  const [portfolios, setPortfolios] = useState([])
  const [defaultPath, setDefaultPath] = useState(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName]   = useState('')
  const [error, setError]       = useState('')

  useEffect(() => {
    window.api.listPortfolios().then(({ portfolios, default: def }) => {
      setPortfolios(portfolios.sort((a, b) => b.lastOpened?.localeCompare(a.lastOpened ?? '') ?? 0))
      setDefaultPath(def)
    })
  }, [])

  async function handleSelect(path) {
    setError('')
    try {
      await window.api.switchPortfolio({ path })
      onOpen()
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
      if (result) onOpen()
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleOpen() {
    setError('')
    try {
      const result = await window.api.openPortfolio()
      if (result) onOpen()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Vinance</h1>
        <p className="text-gray-500 text-sm mb-8">Personal finance, local and private.</p>

        {portfolios.length > 0 && (
          <div className="bg-white rounded-lg border mb-4">
            <div className="px-4 py-2 border-b text-xs font-medium text-gray-500 uppercase tracking-wide">
              Recent portfolios
            </div>
            <ul className="divide-y">
              {portfolios.map(p => (
                <li key={p.path}>
                  <button
                    onClick={() => handleSelect(p.path)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium flex items-center gap-2">
                        {p.name}
                        {p.path === defaultPath && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">default</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 truncate">{p.path}</div>
                    </div>
                    <span className="text-blue-500 text-sm shrink-0">Open →</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {creating ? (
            <form onSubmit={handleCreate} className="bg-white border rounded-lg p-4 flex flex-col gap-3">
              <label className="text-sm font-medium">Portfolio name</label>
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. Personal"
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
            <button
              onClick={() => setCreating(true)}
              className="bg-blue-600 text-white rounded-lg px-4 py-3 text-sm font-medium hover:bg-blue-700"
            >
              + New portfolio
            </button>
          )}

          <button
            onClick={handleOpen}
            className="bg-white border rounded-lg px-4 py-3 text-sm hover:bg-gray-50"
          >
            Open existing portfolio…
          </button>
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  )
}
