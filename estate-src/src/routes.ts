export type RouteItem = {
  path: string
  label: string
  icon: 'home' | 'check' | 'book' | 'file' | 'calendar' | 'note' | 'folder' | 'user' | 'settings' | 'dollar'
  primary?: boolean
}

export const ROUTES: RouteItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: 'home', primary: true },
  { path: '/tasks', label: 'Tasks', icon: 'check', primary: true },
  { path: '/guidance', label: 'Guidance', icon: 'book', primary: true },
  { path: '/documents', label: 'Documents', icon: 'file', primary: true },

  { path: '/calendar', label: 'Calendar', icon: 'calendar' },
  { path: '/journal', label: 'Journal', icon: 'note' },
  { path: '/buyout', label: 'Buyout', icon: 'dollar' },
  { path: '/profile', label: 'Profile', icon: 'user' },
  { path: '/setup', label: 'Setup', icon: 'settings' },
]
