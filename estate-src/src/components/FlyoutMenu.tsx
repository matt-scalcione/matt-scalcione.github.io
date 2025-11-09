import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Calendar,
  CheckSquare,
  DollarSign,
  FileText,
  Folder,
  Home,
  LucideIcon,
  MoreHorizontal,
  NotebookPen,
  Settings,
  User,
  X,
} from 'lucide-react'

import { ROUTES, RouteItem } from '../routes'

const ICONS: Record<RouteItem['icon'], LucideIcon> = {
  home: Home,
  check: CheckSquare,
  book: BookOpen,
  file: FileText,
  calendar: Calendar,
  note: NotebookPen,
  folder: Folder,
  user: User,
  settings: Settings,
  dollar: DollarSign,
}

type FlyoutMenuProps = {
  open: boolean
  onClose: () => void
  overdueCount: number
  onLogout: () => void
}

const FlyoutMenu = ({ open, onClose, overdueCount, onLogout }: FlyoutMenuProps) => {
  const navigate = useNavigate()
  const location = useLocation()
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (open) {
      const previouslyFocused = document.activeElement as HTMLElement | null
      document.body.style.setProperty('overflow', 'hidden')
      const timer = window.setTimeout(() => {
        closeBtnRef.current?.focus({ preventScroll: true })
      }, 0)

      return () => {
        window.clearTimeout(timer)
        document.body.style.removeProperty('overflow')
        previouslyFocused?.focus?.()
      }
    }

    return undefined
  }, [open])

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  if (!open) {
    return null
  }

  const handleNavigate = (path: string) => {
    onClose()
    navigate(path)
  }

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="flyout-backdrop" onClick={handleBackdropClick}>
        <div className="flyout-panel shadow-xl">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-500">Navigation</p>
              <p className="text-lg font-semibold text-slate-900">Quick access</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Close menu"
                ref={closeBtnRef}
                onClick={onClose}
                className="rounded-full border border-slate-200 p-2 text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
              >
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {ROUTES.map((route) => {
              const Icon = ICONS[route.icon]
              const isActive = location.pathname.startsWith(route.path)

              return (
                <button
                  key={route.path}
                  type="button"
                  onClick={() => handleNavigate(route.path)}
                  className={`flex items-center justify-between rounded-2xl border border-transparent px-4 py-3 text-left transition-colors focus-visible:ring-offset-0 ${
                    isActive ? 'bg-primary-50 text-primary-700' : 'hover:border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-3 text-sm font-semibold">
                    <Icon size={18} className="text-primary-500" />
                    <span className="flex items-center gap-2">
                      {route.label}
                      {route.path === '/tasks' && overdueCount > 0 ? (
                        <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1.5 text-xs font-semibold text-white">
                          {overdueCount}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <MoreHorizontal size={18} className="text-slate-400" />
                </button>
              )
            })}
          </div>
          <div className="mt-6 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => {
                onClose()
                onLogout()
              }}
              className="flex w-full items-center justify-between rounded-2xl border border-transparent px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 focus-visible:ring-offset-0"
            >
              <span>Logout</span>
              <X size={16} className="rotate-45" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FlyoutMenu
