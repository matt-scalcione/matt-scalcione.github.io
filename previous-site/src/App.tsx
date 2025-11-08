import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { TasksPage } from './pages/TasksPage'
import { CalendarPage } from './pages/CalendarPage'
import { DocumentsPage } from './pages/DocumentsPage'
import { AssetsPage } from './pages/AssetsPage'
import { ExpensesPage } from './pages/ExpensesPage'
import { BeneficiariesPage } from './pages/BeneficiariesPage'
import { SettingsPage } from './pages/SettingsPage'
import { AppLayout } from './components/AppLayout'

const RequireAuth = ({ children }: { children: JSX.Element }) => {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return children
}

const ProtectedApp = () => {
  return (
    <DataProvider>
      <AppLayout>
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
      </AppLayout>
    </DataProvider>
  )
}

export const App = () => {
  const { isAuthenticated, initializing } = useAuth()

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-600 dark:bg-slate-950 dark:text-slate-200">
        <div className="space-y-2 text-center">
          <span className="inline-flex h-12 w-12 animate-spin rounded-full border-4 border-brand-500 border-t-transparent"></span>
          <p className="text-sm font-medium">Loading estate workspace…</p>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <ProtectedApp />
          </RequireAuth>
        }
      />
    </Routes>
  )
}
