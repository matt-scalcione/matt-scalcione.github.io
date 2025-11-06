import { ReactNode, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { FaBars, FaTimes } from 'react-icons/fa'

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/tasks', label: 'Tasks' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/documents', label: 'Documents' },
  { to: '/assets', label: 'Assets' },
  { to: '/expenses', label: 'Expenses' },
  { to: '/beneficiaries', label: 'Beneficiaries' },
  { to: '/settings', label: 'Settings' }
]

export const Layout = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false)

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-header">
          <span className="logo">Estate Executor Dashboard</span>
          <button className="sidebar-toggle" onClick={() => setOpen(!open)} aria-label="Toggle navigation">
            {open ? <FaTimes /> : <FaBars />}
          </button>
        </div>
        <nav>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setOpen(false)}
              end={item.to === '/'}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="app-content">
        <header className="app-topbar">
          <button className="sidebar-toggle mobile" onClick={() => setOpen(!open)} aria-label="Toggle navigation">
            <FaBars />
          </button>
          <h1 className="app-title">Estate Executor Dashboard</h1>
        </header>
        <main className="app-main">{children}</main>
      </div>
    </div>
  )
}
