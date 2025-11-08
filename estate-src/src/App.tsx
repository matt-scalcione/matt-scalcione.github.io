import { useEffect, useState } from 'react'
import { Navigate, NavLink, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
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
              className="text-sm font-medium text-slate-600 transition hover:text-primary-600"
            >
              Logout
            </button>
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
            className="flex flex-col items-center gap-1 text-slate-500 transition hover:text-primary-600"
          >
            <span className="text-base">⎋</span>
            Logout
          </button>
        </div>
      </nav>
    </div>
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
