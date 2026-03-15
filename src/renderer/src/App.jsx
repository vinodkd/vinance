import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { DrawerProvider } from './context/DrawerContext'
import DrawerHost from './drawers/DrawerHost'
import AccountsView from './views/AccountsView'
import TransactionsView from './views/TransactionsView'
import RulesView from './views/RulesView'
import ReportsView from './views/ReportsView'
import BudgetsView from './views/BudgetsView'
import CategoriesView from './views/CategoriesView'
import PortfoliosView from './views/PortfoliosView'

const NAV = [
  { to: '/accounts',     label: 'Overview' },
  { to: '/transactions', label: 'Transactions' },
  { to: '/categories',   label: 'Categories' },
  { to: '/rules',        label: 'Rules' },
  { to: '/reports',      label: 'Reports' },
  { to: '/budgets',      label: 'Budgets' },
]

export default function App() {
  return (
    <DrawerProvider>
      <div className="flex h-screen overflow-hidden">
        {/* Left nav */}
        <nav className="w-44 shrink-0 bg-gray-800 text-white flex flex-col p-4 gap-1">
          <NavLink
            to="/portfolios"
            className={({ isActive }) =>
              `px-3 py-2 rounded text-sm font-bold mb-4 ${isActive ? 'bg-gray-600' : 'hover:bg-gray-700'}`
            }
          >
            Vinance
          </NavLink>
          {NAV.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `px-3 py-2 rounded text-sm ${isActive ? 'bg-gray-600 font-semibold' : 'hover:bg-gray-700'}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Main content */}
        <main className="flex-1 overflow-auto p-6">
          <Routes>
            <Route path="/"             element={<Navigate to="/portfolios" replace />} />
            <Route path="/portfolios"   element={<PortfoliosView />} />
            <Route path="/accounts"     element={<AccountsView />} />
            <Route path="/transactions" element={<TransactionsView />} />
            <Route path="/categories"   element={<CategoriesView />} />
            <Route path="/rules"        element={<RulesView />} />
            <Route path="/reports"      element={<ReportsView />} />
            <Route path="/budgets"      element={<BudgetsView />} />
          </Routes>
        </main>
      </div>

      {/* Global drawer layer — renders on top of everything */}
      <DrawerHost />
    </DrawerProvider>
  )
}
