import { useEffect, useState } from 'react'
import { Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { liveQuery, type Subscription } from 'dexie'
import Calendar from './pages/Calendar'
import Dashboard from './pages/Dashboard'
import Documents from './pages/Documents'
import Journal from './pages/Journal'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import Profile from './pages/Profile'
import Tasks from './pages/Tasks'
import { useAuth } from './context/AuthContext'
import { db } from './storage/tasksDB'

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/tasks', label: 'Tasks' },
  { to: '/documents', label: 'Documents' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/journal', label: 'Journal' },
  { to: '/profile', label: 'Profile' },
]

const Layout = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout } = useAuth()
  const [overdueCount, setOverdueCount] = useState(0)

  useEffect(() => {
    let isMounted = true
    let subscription: Subscription | undefined

    subscription = liveQuery(() => db.tasks.toArray()).subscribe({
      next: (rows) => {
        if (!isMounted) return
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const count = rows.filter((task) => {
          if (task.status === 'done') return false
          const due = new Date(task.due_date)
          if (Number.isNaN(due.valueOf())) return false
          return due < today
        }).length

        setOverdueCount(count)
      },
      error: (err) => {
        console.error(err)
      },
    })

    return () => {
      isMounted = false
      subscription?.unsubscribe()
    }
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-primary-500/10 p-2 text-lg text-primary-600">🏛️</span>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary-500">Estate</p>
              <p className="text-lg font-semibold text-slate-900">Administration Workspace</p>
            </div>
          </div>
          <nav className="hidden items-center gap-2 md:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-offset-0 ${
                    isActive
                      ? 'bg-primary-50 text-primary-700 shadow-inner shadow-primary-200/40'
                      : 'text-slate-600 hover:bg-primary-50/60 hover:text-primary-600'
                  }`
                }
              >
                <span className="flex items-center gap-2">
                  {item.label}
                  {item.to === '/tasks' && overdueCount > 0 ? (
                    <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1.5 text-xs font-semibold text-white">
                      {overdueCount}
                    </span>
                  ) : null}
                </span>
              </NavLink>
            ))}
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-600 focus-visible:ring-offset-0"
            >
              Logout
            </button>
          </nav>
        </div>
      </header>
      <main className="main-shell">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 lg:py-12">
          <div key={location.pathname} className="animate-fade-in">
            <Outlet />
          </div>
        </div>
      </main>
      <nav className="bottom-toolbar md:hidden text-xs font-medium text-slate-500">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            aria-label={item.label}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 rounded-2xl px-3 py-2 transition-colors focus-visible:ring-offset-0 ${
                isActive ? 'bg-primary-50 text-primary-600' : 'text-slate-500 hover:bg-primary-50/70 hover:text-primary-600'
              }`
            }
          >
            <span className="text-base">•</span>
            <span className="flex items-center gap-1">
              {item.label}
              {item.to === '/tasks' && overdueCount > 0 ? (
                <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[0.625rem] font-semibold text-white">
                  {overdueCount}
                </span>
              ) : null}
            </span>
          </NavLink>
        ))}
        <button
          type="button"
          onClick={handleLogout}
          aria-label="Logout"
          className="flex flex-col items-center gap-1 rounded-2xl px-3 py-2 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 focus-visible:ring-offset-0"
        >
          <span className="text-base">⎋</span>
          Logout
        </button>
      </nav>
    </>
  )
}

const RequireAuth = () => {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

const App = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/tasks">
            <Route index element={<Tasks />} />
            <Route path=":taskId" element={<Tasks />} />
          </Route>
          <Route path="/documents" element={<Documents />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
