import { compareSync } from 'bcryptjs'
import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'

const VALID_USERNAME = 'matt'
const PASSWORD_HASH = '$2b$12$k06H0pTAlXNVyy3DMhdPU.8tb6ZBiIPIi4iX9/9.Vdg7yQZm2cDce'
const SESSION_STORAGE_KEY = 'estate_session_token'

interface AuthContextValue {
  isAuthenticated: boolean
  login: (username: string, password: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const generateSessionToken = () => {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return window.crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(SESSION_STORAGE_KEY)
    } catch (error) {
      console.warn('Unable to read session from storage', error)
      return null
    }
  })

  const login = useCallback((username: string, password: string) => {
    const normalizedUsername = username.trim().toLowerCase()

    if (normalizedUsername !== VALID_USERNAME) {
      throw new Error('Invalid credentials')
    }

    const isValidPassword = compareSync(password, PASSWORD_HASH)

    if (!isValidPassword) {
      throw new Error('Invalid credentials')
    }

    const sessionToken = generateSessionToken()

    try {
      localStorage.setItem(SESSION_STORAGE_KEY, sessionToken)
    } catch (error) {
      console.warn('Unable to persist session token', error)
    }

    setToken(sessionToken)
  }, [])

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY)
    } catch (error) {
      console.warn('Unable to clear session token', error)
    }

    setToken(null)
  }, [])

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(token),
      login,
      logout,
    }),
    [login, logout, token],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}
