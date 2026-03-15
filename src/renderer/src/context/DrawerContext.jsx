import { createContext, useContext, useState } from 'react'

const DrawerContext = createContext(null)

/**
 * Drawers are identified by name. Each drawer component registers itself by
 * checking `drawerName === currentDrawer`.
 *
 * Usage:
 *   const { openDrawer, closeDrawer } = useDrawer()
 *   openDrawer('addCategory', { parentId: 3 })
 */
export function DrawerProvider({ children }) {
  const [current, setCurrent] = useState(null)  // { name, data }

  const openDrawer  = (name, data = {}) => setCurrent({ name, data })
  const closeDrawer = ()                => setCurrent(null)

  return (
    <DrawerContext.Provider value={{ current, openDrawer, closeDrawer }}>
      {children}
    </DrawerContext.Provider>
  )
}

export function useDrawer() {
  return useContext(DrawerContext)
}
