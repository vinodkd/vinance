import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function PortfoliosView() {
  const [portfolios,   setPortfolios]   = useState([])
  const [current,      setCurrent]      = useState(null)
  const [defaultPath,  setDefaultPath]  = useState(null)
  const [creating,     setCreating]     = useState(false)
  const [newName,      setNewName]      = useState('')
  const [error,        setError]        = useState('')
  const navigate = useNavigate()

  function reload() {
    Promise.all([window.api.listPortfolios(), window.api.currentPortfolio()])
      .then(([{ portfolios, default: def }, cur]) => {
        setPortfolios(portfolios.sort((a, b) => (b.lastOpened ?? '').localeCompare(a.lastOpened ?? '')))
        setDefaultPath(def)
        setCurrent(cur)
      })
  }

  useEffect(() => { reload() }, [])

  async function handleSwitch(path) {
    if (path === current?.path) { navigate('/accounts'); return }
    setError('')
    try {
      await window.api.switchPortfolio({ path })
      window.location.reload()
    } catch (e) { setError(e.message) }
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!newName.trim()) return
    setError('')
    try {
      const result = await window.api.createPortfolio({ name: newName.trim() })
      if (result) window.location.reload()
    } catch (e) { setError(e.message) }
  }

  async function handleOpen() {
    setError('')
    try {
      const result = await window.api.openPortfolio()
      if (result) window.location.reload()
    } catch (e) { setError(e.message) }
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
    reload()
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Portfolios</h1>
        <div className="flex gap-2">
          {creating ? null : (
            <>
              <button onClick={() => setCreating(true)}
                className="bg-blue-600 text-white rounded px-3 py-1.5 text-sm hover:bg-blue-700">
                + New
              </button>
              <button onClick={handleOpen}
                className="border rounded px-3 py-1.5 text-sm hover:bg-gray-50">
                Open file…
              </button>
            </>
          )}
        </div>
      </div>

      {creating && (
        <form onSubmit={handleCreate} className="bg-white border rounded-lg p-4 flex flex-col gap-3 mb-4">
          <label className="text-sm font-medium">Portfolio name</label>
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="e.g. Personal"
            className="border rounded px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button type="submit"
              className="flex-1 bg-blue-600 text-white rounded py-2 text-sm font-medium hover:bg-blue-700">
              Choose location…
            </button>
            <button type="button" onClick={() => { setCreating(false); setNewName('') }}
              className="flex-1 border rounded py-2 text-sm hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      {portfolios.length === 0 && !creating ? (
        <p className="text-gray-500 text-sm">No portfolios yet. Create one to get started.</p>
      ) : (
        <div className="bg-white border rounded-lg divide-y">
          {portfolios.map(p => (
            <div key={p.path} className={`flex items-center gap-3 px-4 py-3 ${p.path === current?.path ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleSwitch(p.path)}>
                <div className="font-medium text-sm flex items-center gap-2 flex-wrap">
                  {p.name}
                  {p.path === current?.path && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">open</span>
                  )}
                  {p.path === defaultPath && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">default</span>
                  )}
                </div>
                <div className="text-xs text-gray-400 truncate">{p.path}</div>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-xs">
                {p.path === current?.path ? (
                  <button onClick={() => navigate('/accounts')}
                    className="text-blue-600 hover:underline font-medium">
                    Open →
                  </button>
                ) : (
                  <button onClick={() => handleSwitch(p.path)}
                    className="text-blue-500 hover:underline">
                    Switch
                  </button>
                )}
                {p.path !== defaultPath && (
                  <button onClick={e => handleSetDefault(e, p.path)}
                    className="text-gray-400 hover:text-gray-700">
                    Set default
                  </button>
                )}
                {p.path !== current?.path && (
                  <button onClick={e => handleRemove(e, p.path)}
                    className="text-red-400 hover:text-red-600">
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </div>
  )
}
