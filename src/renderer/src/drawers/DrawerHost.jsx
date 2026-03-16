import { useRef, useEffect } from 'react'
import { useDrawer } from '../context/DrawerContext'
import AddAccountDrawer from './AddAccountDrawer'
import AddCategoryDrawer from './AddCategoryDrawer'
import AddGroupDrawer from './AddGroupDrawer'
import AddRuleDrawer from './AddRuleDrawer'
import SwitchPortfolioDrawer from './SwitchPortfolioDrawer'
import TransferMatcherDrawer from './TransferMatcherDrawer'

// Register all drawers here by name
const DRAWERS = {
  addAccount:       AddAccountDrawer,
  addCategory:      AddCategoryDrawer,
  addGroup:         AddGroupDrawer,
  addRule:          AddRuleDrawer,
  switchPortfolio:  SwitchPortfolioDrawer,
  transferMatcher:  TransferMatcherDrawer,
}

export default function DrawerHost() {
  const { current, closeDrawer } = useDrawer()
  const panelRef = useRef(null)

  // Focus the first input/select/textarea in the drawer after it opens.
  // 50ms gives Electron time to complete the OS-level window focus handoff.
  useEffect(() => {
    if (!current) return
    const t = setTimeout(() => {
      const el = panelRef.current?.querySelector('input, select, textarea')
      el?.focus()
    }, 50)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.name])

  if (!current) return null

  const Component = DRAWERS[current.name]
  if (!Component) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="flex-1 bg-black/30"
        onClick={closeDrawer}
      />
      {/* Drawer panel */}
      <div ref={panelRef} className="w-96 bg-white shadow-xl flex flex-col overflow-y-auto">
        <Component data={current.data} onClose={closeDrawer} />
      </div>
    </div>
  )
}
