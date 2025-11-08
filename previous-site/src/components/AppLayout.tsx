import { ReactNode, useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBars,
  faBell,
  faCalendarDays,
  faFileLines,
  faGaugeHigh,
  faListCheck,
  faRightFromBracket,
  faUserGroup,
  faVault,
  faCoins,
  faGear,
  faPlus
} from '@fortawesome/free-solid-svg-icons'
import clsx from 'clsx'
import { useAuth } from '../context/AuthContext'
import { useDataContext } from '../context/DataContext'

const navItems = [
  { to: '/', label: 'Dashboard', icon: faGaugeHigh },
  { to: '/tasks', label: 'Tasks', icon: faListCheck },
  { to: '/calendar', label: 'Calendar', icon: faCalendarDays },
  { to: '/documents', label: 'Documents', icon: faVault },
  { to: '/assets', label: 'Assets', icon: faFileLines },
  { to: '/expenses', label: 'Expenses', icon: faCoins },
  { to: '/beneficiaries', label: 'Beneficiaries', icon: faUserGroup },
  { to: '/settings', label: 'Settings', icon: faGear }
]

const applyTheme = (theme: 'light' | 'dark' | 'system') => {
  const root = document.documentElement
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark)
  root.classList.toggle('dark', isDark)
}

export const AppLayout = ({ children }: { children: ReactNode }) => {
  const { logout } = useAuth()
  const { profile, settings, deadlines } = useDataContext()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    applyTheme(settings.theme)
    const listener = (event: MediaQueryListEvent) => {
      if (settings.theme === 'system') {
        applyTheme('system')
      }
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [settings.theme])

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  const estateTitle = profile?.decedentFullName
    ? `${profile.decedentFullName} Estate`
    : 'Estate Executor Dashboard'

  const nextDeadline = useMemo(() => {
    const timeline = [
      deadlines.rule105Notice,
      deadlines.certificationOfNotice,
      deadlines.inventoryDue,
      deadlines.inheritanceTaxDue,
      deadlines.inheritanceTaxDiscount,
      deadlines.creditorBarDate
    ]
      .filter(Boolean)
      .sort()
    return timeline[0]
  }, [deadlines])

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900 transition dark:bg-slate-950 dark:text-slate-100">
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-30 w-72 transform bg-slate-900 text-slate-100 shadow-xl transition-transform lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex items-center justify-between px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Estate workspace</p>
            <h1 className="text-lg font-semibold">{estateTitle}</h1>
          </div>
          <button
            type="button"
            className="rounded-full bg-slate-800 p-2 text-slate-200 hover:bg-slate-700 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
          >
            <FontAwesomeIcon icon={faBars} className="h-4 w-4" />
          </button>
        </div>
        <nav className="space-y-1 px-3 pb-8">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                  isActive
                    ? 'bg-brand-500 text-white shadow'
                    : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                )
              }
              end={item.to === '/'}
            >
              <FontAwesomeIcon icon={item.icon} className="h-4 w-4" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex items-center justify-between px-4 py-3 lg:px-8">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-lg bg-slate-200 p-2 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 lg:hidden"
                onClick={() => setSidebarOpen((prev) => !prev)}
                aria-label="Toggle navigation"
              >
                <FontAwesomeIcon icon={faBars} className="h-5 w-5" />
              </button>
              <div>
                <h2 className="text-lg font-semibold">{estateTitle}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {profile?.county ? `${profile.county} County, ${profile.state ?? 'PA'}` : 'Set estate profile in Settings'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {nextDeadline && (
                <div className="hidden items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-200 md:flex">
                  <FontAwesomeIcon icon={faBell} />
                  <span>Next deadline: {nextDeadline}</span>
                </div>
              )}
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate('/tasks', { state: { newTask: true } })}
              >
                <FontAwesomeIcon icon={faPlus} /> Add task
              </button>
              <button
                type="button"
                className="rounded-full bg-slate-200 p-2 text-slate-600 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                onClick={logout}
                aria-label="Sign out"
              >
                <FontAwesomeIcon icon={faRightFromBracket} />
              </button>
            </div>
          </div>
        </header>
        <main className="flex-1 bg-slate-100 p-4 dark:bg-slate-950 lg:p-8">
          <div className="mx-auto w-full max-w-7xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
