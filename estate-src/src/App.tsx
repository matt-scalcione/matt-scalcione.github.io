import { Navigate, NavLink, Outlet, Route, Routes } from 'react-router-dom'
import Calendar from './pages/Calendar'
import Dashboard from './pages/Dashboard'
import Documents from './pages/Documents'
import Journal from './pages/Journal'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import Profile from './pages/Profile'
import Tasks from './pages/Tasks'

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/tasks', label: 'Tasks' },
  { to: '/documents', label: 'Documents' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/journal', label: 'Journal' },
  { to: '/profile', label: 'Profile' },
]

const Layout = () => {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 md:px-6">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary-500/10 p-2 text-primary-600">🏛️</span>
            <span className="text-xl font-semibold text-slate-900">Estate</span>
          </div>
          <nav className="hidden items-center gap-6 md:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `text-sm font-medium transition hover:text-primary-600 ${
                    isActive ? 'text-primary-600' : 'text-slate-600'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
          <Outlet />
        </div>
      </main>
      <nav className="sticky bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-around px-4 py-3 text-sm font-medium text-slate-500">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 ${
                  isActive ? 'text-primary-600' : 'text-slate-500'
                }`
              }
            >
              <span className="text-base">•</span>
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

const App = () => {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/journal" element={<Journal />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

export default App
