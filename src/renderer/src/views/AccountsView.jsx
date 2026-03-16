import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDrawer } from '../context/DrawerContext'

export default function AccountsView() {
  const [accounts, setAccounts] = useState([])
  const [groups,   setGroups]   = useState([])
  const [importing, setImporting] = useState(null)
  const [renaming,  setRenaming]  = useState(null) // { id, name }
  const [renamingGroup, setRenamingGroup] = useState(null) // { id, name }
  const { openDrawer } = useDrawer()
  const navigate = useNavigate()

  const load = useCallback(async () => {
    const [accts, grps] = await Promise.all([window.api.listAccounts(), window.api.listGroups()])
    setAccounts(accts)
    setGroups(grps)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    window.addEventListener('vinance:accounts:changed', load)
    return () => window.removeEventListener('vinance:accounts:changed', load)
  }, [load])

  async function handleDelete(acct) {
    if (!confirm(`Delete "${acct.name}" and all its transactions? This cannot be undone.`)) return
    await window.api.deleteAccount(acct.id)
    load()
  }

  async function handleRename(id, name) {
    if (!name.trim()) return
    await window.api.renameAccount(id, name.trim())
    setRenaming(null)
    load()
  }

  async function handleSetGroup(accountId, groupId) {
    await window.api.setAccountGroup(accountId, groupId || null)
    load()
  }

  function handleCreateGroup() {
    openDrawer('addGroup', { onCreated: load })
  }

  async function handleRenameGroup(id, name) {
    if (!name.trim()) return
    await window.api.renameGroup(id, name.trim())
    setRenamingGroup(null)
    load()
  }

  async function handleDeleteGroup(group) {
    if (!confirm(`Remove group "${group.name}"? Accounts in this group will become ungrouped.`)) return
    await window.api.deleteGroup(group.id)
    load()
  }

  async function handleImport(accountId = null) {
    const filePath = await window.api.openFileDialog()
    if (!filePath) return
    setImporting(accountId ?? 'new')
    try {
      const result = await window.api.importFile(filePath, accountId)
      const msg = [`Imported ${result.imported} transactions (${result.skipped} duplicates skipped).`]
      if (result.reconciled > 0) msg.push(`${result.reconciled} pending transfer${result.reconciled > 1 ? 's' : ''} auto-linked.`)
      alert(msg.join('\n'))
      load()
    } catch (err) {
      alert(`Import failed: ${err.message}`)
    } finally {
      setImporting(null)
    }
  }

  // Group accounts: each group + an "Ungrouped" bucket
  const grouped = groups.map(g => ({
    ...g,
    accounts: accounts.filter(a => a.group_id === g.id)
  }))
  const ungrouped = accounts.filter(a => !a.group_id)

  // Per-currency totals across all accounts
  const totals = accounts.reduce((acc, a) => {
    acc[a.currency] = (acc[a.currency] || 0) + a.balance
    return acc
  }, {})

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Overview</h1>
        <div className="flex gap-2">
          <button onClick={handleCreateGroup}
            className="border rounded px-3 py-1.5 text-sm hover:bg-gray-50">
            + Group
          </button>
          <button onClick={() => openDrawer('addAccount', { onCreated: load })}
            className="border rounded px-3 py-1.5 text-sm hover:bg-gray-50">
            + Account
          </button>
          <button onClick={() => openDrawer('addCategory')}
            className="border rounded px-3 py-1.5 text-sm hover:bg-gray-50">
            + Category
          </button>
          <button onClick={() => handleImport(null)} disabled={importing === 'new'}
            className="bg-blue-600 text-white rounded px-3 py-1.5 text-sm hover:bg-blue-700 disabled:opacity-50">
            {importing === 'new' ? 'Importing…' : 'Import OFX/QFX'}
          </button>
        </div>
      </div>

      {accounts.length === 0 ? (
        <p className="text-gray-500 text-sm">No accounts yet. Create one or import an OFX/QFX file to get started.</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          {/* Total row */}
          <div className="bg-gray-100 px-3 py-2 flex items-center text-sm font-medium text-gray-600 border-b">
            <span className="flex-1">Total</span>
            <div className="flex gap-4">
              {Object.entries(totals).map(([currency, total]) => (
                <span key={currency} className={`tabular-nums font-bold ${total < 0 ? 'text-red-600' : 'text-green-700'}`}>
                  {fmt(total, currency)}
                </span>
              ))}
            </div>
          </div>

          {/* Grouped sections */}
          {grouped.map(g => (
            <GroupSection key={g.id} group={g} renamingGroup={renamingGroup}
              setRenamingGroup={setRenamingGroup} onRenameGroup={handleRenameGroup}
              onDeleteGroup={handleDeleteGroup} groups={groups}
              accounts={g.accounts} renaming={renaming} setRenaming={setRenaming}
              onRename={handleRename} onSetGroup={handleSetGroup}
              onDelete={handleDelete} onImport={handleImport} importing={importing}
              navigate={navigate} />
          ))}

          {/* Ungrouped accounts */}
          {ungrouped.length > 0 && (
            <UngroupedSection accounts={ungrouped} groups={groups}
              renaming={renaming} setRenaming={setRenaming}
              onRename={handleRename} onSetGroup={handleSetGroup}
              onDelete={handleDelete} onImport={handleImport} importing={importing}
              navigate={navigate} />
          )}
        </div>
      )}
    </div>
  )
}

function GroupSection({ group, renamingGroup, setRenamingGroup, onRenameGroup, onDeleteGroup,
  groups, accounts, renaming, setRenaming, onRename, onSetGroup,
  onDelete, onImport, importing, navigate }) {

  const [collapsed, setCollapsed] = useState(false)

  const subtotals = accounts.reduce((acc, a) => {
    acc[a.currency] = (acc[a.currency] || 0) + a.balance
    return acc
  }, {})

  return (
    <>
      <div className="bg-gray-50 px-3 py-1.5 flex items-center gap-2 border-b text-sm">
        <button onClick={() => setCollapsed(c => !c)}
          className="text-gray-400 hover:text-gray-600 w-4 text-center">
          {collapsed ? '▶' : '▼'}
        </button>
        {renamingGroup?.id === group.id ? (
          <GroupRenameInput value={renamingGroup.name}
            onChange={e => setRenamingGroup({ ...renamingGroup, name: e.target.value })}
            onBlur={() => onRenameGroup(group.id, renamingGroup.name)}
            onKeyDown={e => { if (e.key === 'Enter') onRenameGroup(group.id, renamingGroup.name); if (e.key === 'Escape') setRenamingGroup(null) }} />
        ) : (
          <span className="font-medium text-gray-700 cursor-pointer hover:text-blue-600 group flex-1"
            onClick={() => setRenamingGroup({ id: group.id, name: group.name })}>
            {group.name}
            <span className="ml-1 text-xs text-gray-400 opacity-0 group-hover:opacity-100">✎</span>
          </span>
        )}
        <div className="flex gap-3 ml-auto items-center">
          {Object.entries(subtotals).map(([cur, total]) => (
            <span key={cur} className={`tabular-nums text-xs font-semibold ${total < 0 ? 'text-red-500' : 'text-green-700'}`}>
              {fmt(total, cur)}
            </span>
          ))}
          <button onClick={() => onDeleteGroup(group)}
            className="text-xs text-gray-400 hover:text-red-500">✕</button>
        </div>
      </div>
      {!collapsed && accounts.map(acct => (
        <AccountRow key={acct.id} acct={acct} groups={groups}
          renaming={renaming} setRenaming={setRenaming} onRename={onRename}
          onSetGroup={onSetGroup} onDelete={onDelete} onImport={onImport}
          importing={importing} navigate={navigate} />
      ))}
    </>
  )
}

function UngroupedSection({ accounts, groups, renaming, setRenaming, onRename,
  onSetGroup, onDelete, onImport, importing, navigate }) {
  return (
    <>
      {groups.length > 0 && (
        <div className="bg-gray-50 px-3 py-1.5 border-b text-xs font-medium text-gray-400 uppercase tracking-wide">
          Ungrouped
        </div>
      )}
      {accounts.map(acct => (
        <AccountRow key={acct.id} acct={acct} groups={groups}
          renaming={renaming} setRenaming={setRenaming} onRename={onRename}
          onSetGroup={onSetGroup} onDelete={onDelete} onImport={onImport}
          importing={importing} navigate={navigate} />
      ))}
    </>
  )
}

function AccountRow({ acct, groups, renaming, setRenaming, onRename,
  onSetGroup, onDelete, onImport, importing, navigate }) {
  return (
    <div className="px-3 py-2 flex items-center gap-3 border-b last:border-b-0 hover:bg-gray-50 group/row text-sm">
      {/* Name */}
      <div className="flex-1 min-w-0">
        {renaming?.id === acct.id ? (
          <RenameInput value={renaming.name}
            onChange={e => setRenaming({ ...renaming, name: e.target.value })}
            onBlur={() => onRename(acct.id, renaming.name)}
            onKeyDown={e => { if (e.key === 'Enter') onRename(acct.id, renaming.name); if (e.key === 'Escape') setRenaming(null) }} />
        ) : (
          <span className="cursor-pointer hover:text-blue-600 group flex items-center gap-1"
            onClick={() => setRenaming({ id: acct.id, name: acct.name })}>
            <span className="truncate">{acct.name}</span>
            <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 shrink-0">✎</span>
          </span>
        )}
      </div>

      {/* Type · Currency */}
      <span className="text-xs text-gray-400 uppercase whitespace-nowrap">{acct.type} · {acct.currency}</span>

      {/* Group selector */}
      <select value={acct.group_id || ''}
        onChange={e => onSetGroup(acct.id, e.target.value ? Number(e.target.value) : null)}
        className="text-xs border rounded px-1.5 py-0.5 text-gray-500 bg-white max-w-28">
        <option value="">No group</option>
        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
      </select>

      {/* Balance */}
      <span className={`tabular-nums font-semibold w-28 text-right ${acct.balance < 0 ? 'text-red-600' : 'text-green-700'}`}>
        {fmt(acct.balance, acct.currency)}
      </span>

      {/* Actions — visible on row hover */}
      <div className="flex gap-1.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
        <button onClick={() => navigate(`/transactions?accountId=${acct.id}`)}
          className="text-xs border rounded px-2 py-0.5 hover:bg-gray-100">Txns</button>
        <button onClick={() => onImport(acct.id)} disabled={importing === acct.id}
          className="text-xs border rounded px-2 py-0.5 hover:bg-gray-100 disabled:opacity-50">
          {importing === acct.id ? '…' : 'Import'}
        </button>
        <button onClick={() => onDelete(acct)}
          className="text-xs border border-red-200 text-red-400 rounded px-2 py-0.5 hover:bg-red-50 hover:text-red-600">Del</button>
      </div>
    </div>
  )
}

function RenameInput({ value, onChange, onBlur, onKeyDown }) {
  const ref = useRef(null)
  useEffect(() => {
    const t = setTimeout(() => ref.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [])
  return (
    <input ref={ref} value={value} onChange={onChange} onBlur={onBlur} onKeyDown={onKeyDown}
      className="border rounded px-2 py-0.5 text-sm font-medium w-48" />
  )
}

function GroupRenameInput({ value, onChange, onBlur, onKeyDown }) {
  const ref = useRef(null)
  useEffect(() => {
    const t = setTimeout(() => ref.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [])
  return (
    <input ref={ref} value={value} onChange={onChange} onBlur={onBlur} onKeyDown={onKeyDown}
      className="border rounded px-2 py-0.5 text-sm font-medium w-40" />
  )
}

function fmt(amount, currency = 'USD') {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
}
