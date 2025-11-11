import { useEffect, useState } from 'react'
import { Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { liveQuery } from 'dexie'
import { MoreHorizontal } from 'lucide-react'
import Calendar from './pages/Calendar'
import Dashboard from './pages/Dashboard'
import Documents from './pages/Documents'
import Buyout from './pages/Buyout'
import Guidance from './pages/Guidance'
import Journal from './pages/Journal'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import Profile from './pages/Profile'
import Tasks from './pages/Tasks'
import Setup from './pages/Setup'
import { useAuth } from './context/AuthContext'
import { db } from './storage/tasksDB'
import { syncTasksFromCloud } from './data/cloud'
import { useEstate } from './context/EstateContext'
import FlyoutMenu from './components/FlyoutMenu'
import BottomBar from './components/BottomBar'
import { ROUTES } from './routes'

const Layout = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout, mode: authMode, isAuthenticated } = useAuth()
  const { activeEstateId } = useEstate()
  const [overdueCount, setOverdueCount] = useState(0)
  const [flyoutOpen, setFlyoutOpen] = useState(false)

  useEffect(() => {
    if (authMode !== 'supabase' || !isAuthenticated) return
    void syncTasksFromCloud(activeEstateId).catch((error) => {
      console.error(error)
    })
  }, [activeEstateId, authMode, isAuthenticated])

  useEffect(() => {
    let isMounted = true
    const subscription = liveQuery(() => db.tasks.where('estateId').equals(activeEstateId).toArray()).subscribe({
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
      subscription.unsubscribe()
    }
  }, [activeEstateId])

  const handleLogout = () => {
    void (async () => {
      try {
        await logout()
      } catch (error) {
        console.error(error)
      } finally {
        navigate('/login', { replace: true })
      }
    })()
  }

  return (
    <>
      <FlyoutMenu
        open={flyoutOpen}
        onClose={() => setFlyoutOpen(false)}
        overdueCount={overdueCount}
        onLogout={handleLogout}
      />
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-primary-500/10 p-2 text-lg text-primary-600">🏛️</span>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary-500">Estate</p>
              <p className="text-lg font-semibold text-slate-900">Administration Workspace</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <nav className="hidden items-center gap-2 md:flex">
              {ROUTES.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
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
                    {item.path === '/tasks' && overdueCount > 0 ? (
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
            <button
              type="button"
              aria-label="Menu"
              onClick={() => setFlyoutOpen(true)}
              className="rounded-full border border-slate-200 p-2 text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
            >
              <MoreHorizontal size={22} />
            </button>
          </div>
        </div>
      </header>
      <main className="main-shell">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 lg:py-12">
          <div key={location.pathname} className="animate-fade-in">
            <Outlet />
          </div>
        </div>
      </main>
      <BottomBar overdueCount={overdueCount} onOpenFlyout={() => setFlyoutOpen(true)} />
    </>
  )
}

const RequireAuth = () => {
  const { isAuthenticated, isReady } = useAuth()

  if (!isReady) {
    return null
  }

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
          <Route path="/guidance" element={<Guidance />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/buyout" element={<Buyout />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/setup" element={<Setup />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
