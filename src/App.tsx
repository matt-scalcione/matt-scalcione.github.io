import { useEffect, useState } from 'react'
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
import { useDataContext } from './contexts/useDataContext'
import { SESSION_KEY, defaultTasks } from './utils/constants'

export const App = () => {
  const {
    data: { tasks, metadata },
    isLoaded,
    replaceTasks,
    markChecklistSeeded
  } = useDataContext()

  const [authenticated, setAuthenticated] = useState(() => sessionStorage.getItem(SESSION_KEY) === 'true')

  useEffect(() => {
    if (!isLoaded) return
    if (tasks.length === 0 && !metadata.checklistSeeded) {
      replaceTasks(defaultTasks())
      markChecklistSeeded()
    }
  }, [isLoaded, tasks.length, metadata.checklistSeeded, replaceTasks, markChecklistSeeded])

  if (!authenticated) {
    return <Login onAuthenticated={() => setAuthenticated(true)} />
  }

  return (
    <BrowserRouter>
      <Layout>
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

export default App
