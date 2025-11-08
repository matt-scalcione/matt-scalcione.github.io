import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { EstateProvider } from './context/EstateContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename="/estate">
      <AuthProvider>
        <EstateProvider>
          <App />
        </EstateProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
