import { useDrawer } from '../context/DrawerContext'
import AddCategoryDrawer from './AddCategoryDrawer'
import AddRuleDrawer from './AddRuleDrawer'

// Register all drawers here by name
const DRAWERS = {
  addCategory: AddCategoryDrawer,
  addRule:     AddRuleDrawer,
}

export default function DrawerHost() {
  const { current, closeDrawer } = useDrawer()
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
      <div className="w-96 bg-white shadow-xl flex flex-col overflow-y-auto">
        <Component data={current.data} onClose={closeDrawer} />
      </div>
    </div>
  )
}
