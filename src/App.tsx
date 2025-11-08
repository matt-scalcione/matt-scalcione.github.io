import { useCallback, useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { DashboardPage } from './pages/DashboardPage'
import { TasksPage } from './pages/TasksPage'
import { CalendarPage } from './pages/CalendarPage'
import { DocumentsPage } from './pages/DocumentsPage'
import { AssetsPage } from './pages/AssetsPage'
import { ExpensesPage } from './pages/ExpensesPage'
import { BeneficiariesPage } from './pages/BeneficiariesPage'
import { SettingsPage } from './pages/SettingsPage'
import { Layout } from './components/Layout'
import { Login } from './components/Login'
import { DataProvider } from './contexts/DataContext'
import { useDataContext } from './contexts/useDataContext'
import { SESSION_STORAGE_KEY, defaultTasks } from './utils/constants'

type AuthSession = {
  token: string
  userId: string
  username: string
}

const readStoredSession = (): AuthSession | null => {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>
    if (
      parsed &&
      typeof parsed.token === 'string' &&
      typeof parsed.userId === 'string' &&
      typeof parsed.username === 'string'
    ) {
      return parsed as AuthSession
    }
  } catch (error) {
    console.warn('Failed to parse stored session', error)
  }

  window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
  return null
}

const clearStoredSession = () => {
  if (typeof window === 'undefined') {
    return
  }
  window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
}

const AuthenticatedApp = ({ session, onLogout }: { session: AuthSession; onLogout: () => void }) => {
  const {
    data: { tasks, metadata },
    isLoaded,
    replaceTasks,
    markChecklistSeeded
  } = useDataContext()

  useEffect(() => {
    if (!isLoaded) return
    if (tasks.length === 0 && !metadata.checklistSeeded) {
      replaceTasks(defaultTasks())
      markChecklistSeeded()
    }
  }, [isLoaded, tasks.length, metadata.checklistSeeded, replaceTasks, markChecklistSeeded])

  return (
    <BrowserRouter>
      <Layout username={session.username} onLogout={onLogout}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/assets" element={<AssetsPage />} />
          <Route path="/expenses" element={<ExpensesPage />} />
          <Route path="/beneficiaries" element={<BeneficiariesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export const App = () => {
  const [session, setSession] = useState<AuthSession | null>(() => readStoredSession())

  const handleAuthenticated = useCallback((nextSession: AuthSession) => {
    setSession(nextSession)
  }, [])

  const handleLogout = useCallback(() => {
    clearStoredSession()
    setSession(null)
  }, [])

  if (!session) {
    return <Login onAuthenticated={handleAuthenticated} />
  }

  return (
    <DataProvider authToken={session.token} onUnauthorized={handleLogout}>
      <AuthenticatedApp session={session} onLogout={handleLogout} />
    </DataProvider>
  )
}

export default App
