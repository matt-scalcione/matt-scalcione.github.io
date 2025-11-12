import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { EstateProvider } from './context/EstateContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

const Crash = (error: unknown, reset: () => void) => {
  const handleDisableCloud = () => {
    try {
      window.localStorage.setItem('cloud:disabled', '1')
    } catch (storageError) {
      console.warn('Unable to persist safe mode flag', storageError)
    }
    window.location.reload()
  }

  return (
    <div
      style={{
        padding: '16px',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <h2>Something went wrong</h2>
      <pre style={{ whiteSpace: 'pre-wrap' }}>{String((error as Error)?.message ?? error)}</pre>
      <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
        <button type="button" onClick={handleDisableCloud}>
          Disable Cloud and reload
        </button>
        <button type="button" onClick={() => reset()}>
          Try again
        </button>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary fallback={Crash}>
      <BrowserRouter basename="/estate">
        <AuthProvider>
          <EstateProvider>
            <App />
          </EstateProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)
