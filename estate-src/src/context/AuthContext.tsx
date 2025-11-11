import { compareSync } from 'bcryptjs'
import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getClient, hasSupabaseConfig } from '../lib/supabaseClient'

const VALID_USERNAME = 'matt'
const PASSWORD_HASH = '$2b$12$k06H0pTAlXNVyy3DMhdPU.8tb6ZBiIPIi4iX9/9.Vdg7yQZm2cDce'
const SESSION_STORAGE_KEY = 'estate_session_token'

type AuthMode = 'demo' | 'supabase'

interface AuthContextValue {
  isAuthenticated: boolean
  isReady: boolean
  login: (identifier: string, password: string) => Promise<void>
  logout: () => Promise<void>
  mode: AuthMode
  userEmail: string | null
  refreshAuthMode: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const generateSessionToken = () => {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return window.crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [mode, setMode] = useState<AuthMode>(() => (hasSupabaseConfig() ? 'supabase' : 'demo'))
  const [configVersion, setConfigVersion] = useState(0)
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(SESSION_STORAGE_KEY)
    } catch (error) {
      console.warn('Unable to read session from storage', error)
      return null
    }
  })
  const [supabaseSession, setSupabaseSession] = useState<Session | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isReady, setIsReady] = useState<boolean>(mode !== 'supabase')

  const refreshAuthMode = useCallback(() => {
    setConfigVersion((previous) => previous + 1)
    setMode(hasSupabaseConfig() ? 'supabase' : 'demo')
  }, [])

  useEffect(() => {
    if (mode !== 'supabase') {
      setSupabaseSession(null)
      setUserEmail(null)
      setIsReady(true)
      return
    }

    const client = getClient()

    if (!client) {
      setMode('demo')
      setSupabaseSession(null)
      setUserEmail(null)
      setIsReady(true)
      return
    }

    let isMounted = true
    setIsReady(false)

    client.auth
      .getSession()
      .then(({ data, error }) => {
        if (!isMounted) return
        if (error) {
          console.warn('Unable to hydrate Supabase session', error)
          setSupabaseSession(null)
          setUserEmail(null)
        } else {
          setSupabaseSession(data.session ?? null)
          setUserEmail(data.session?.user?.email ?? null)
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsReady(true)
        }
      })

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return
      setSupabaseSession(session)
      setUserEmail(session?.user?.email ?? null)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [mode, configVersion])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const handleStorage = (event: StorageEvent) => {
      if (!event.key) return

      if (event.key === 'estate:supabaseUrl' || event.key === 'estate:supabaseAnonKey') {
        refreshAuthMode()
      }
    }

    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener('storage', handleStorage)
    }
  }, [refreshAuthMode])

  const login = useCallback(
    async (identifier: string, password: string) => {
      if (mode === 'supabase') {
        const client = getClient()

        if (!client) {
          throw new Error('Supabase is not configured.')
        }

        const { error } = await client.auth.signInWithPassword({
          email: identifier.trim(),
          password,
        })

        if (error) {
          throw error
        }

        return
      }

      const normalizedUsername = identifier.trim().toLowerCase()

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
    },
    [mode],
  )

  const logout = useCallback(async () => {
    if (mode === 'supabase') {
      const client = getClient()
      if (client) {
        const { error } = await client.auth.signOut()
        if (error) {
          throw error
        }
      }

      setSupabaseSession(null)
      setUserEmail(null)
      return
    }

    try {
      localStorage.removeItem(SESSION_STORAGE_KEY)
    } catch (error) {
      console.warn('Unable to clear session token', error)
    }

    setToken(null)
  }, [mode])

  const isAuthenticated = mode === 'supabase' ? Boolean(supabaseSession) : Boolean(token)

  const value = useMemo(
    () => ({
      isAuthenticated,
      isReady,
      login,
      logout,
      mode,
      userEmail,
      refreshAuthMode,
    }),
    [isAuthenticated, isReady, login, logout, mode, refreshAuthMode, userEmail],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}
