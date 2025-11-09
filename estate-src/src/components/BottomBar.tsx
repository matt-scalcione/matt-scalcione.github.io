import { NavLink, useLocation } from 'react-router-dom'
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

type BottomBarProps = {
  overdueCount: number
  onOpenFlyout: () => void
}

const BottomBar = ({ overdueCount, onOpenFlyout }: BottomBarProps) => {
  const location = useLocation()
  const primaryRoutes = ROUTES.filter((route) => route.primary)

  return (
    <nav className="bottom-toolbar grid grid-cols-5 md:hidden text-xs font-medium text-slate-500">
      {primaryRoutes.map((route) => {
        const Icon = ICONS[route.icon]

        return (
          <NavLink
            key={route.path}
            to={route.path}
            aria-label={route.label}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 rounded-2xl px-2 py-2 transition-colors focus-visible:ring-offset-0 ${
                isActive ? 'bg-primary-50 text-primary-600' : 'text-slate-500 hover:bg-primary-50/70 hover:text-primary-600'
              }`
            }
          >
            <Icon size={18} />
            <span
              className={`flex items-center gap-1 text-[11px] leading-tight ${
                location.pathname.startsWith(route.path) ? 'font-semibold' : ''
              }`}
            >
              {route.label}
              {route.path === '/tasks' && overdueCount > 0 ? (
                <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[0.625rem] font-semibold text-white">
                  {overdueCount}
                </span>
              ) : null}
            </span>
          </NavLink>
        )
      })}
      <button
        type="button"
        onClick={onOpenFlyout}
        aria-label="More"
        className="flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-slate-500 transition-colors hover:bg-primary-50/70 hover:text-primary-600 focus-visible:ring-offset-0"
      >
        <MoreHorizontal size={18} />
        <span className="text-[11px] font-semibold leading-tight">More</span>
      </button>
    </nav>
  )
}

export default BottomBar
