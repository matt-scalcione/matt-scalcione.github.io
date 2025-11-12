import { compareSync } from 'bcryptjs'
import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getCloud, type CloudStatus } from '../lib/supabaseClient'
import { SAFE_MODE } from '../lib/safeMode'

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
  refreshCloudStatus: () => void
  cloudReady: boolean
  cloudError: string | null
  safeMode: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const generateSessionToken = () => {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return window.crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const initialCloudStatus: CloudStatus = SAFE_MODE ? { ok: false, reason: 'Cloud disabled (safe mode)' } : getCloud()
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>(initialCloudStatus)
  const [mode, setMode] = useState<AuthMode>(() => (!SAFE_MODE && initialCloudStatus.ok ? 'supabase' : 'demo'))
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

  const refreshCloudStatus = useCallback(() => {
    if (SAFE_MODE) {
      setCloudStatus({ ok: false, reason: 'Cloud disabled (safe mode)' })
      return
    }

    setCloudStatus(getCloud())
  }, [])

  useEffect(() => {
    setMode(!SAFE_MODE && cloudStatus.ok ? 'supabase' : 'demo')
  }, [cloudStatus])

  useEffect(() => {
    if (mode !== 'supabase') {
      setSupabaseSession(null)
      setUserEmail(null)
      setIsReady(true)
      return
    }

    if (!cloudStatus.ok) {
      setSupabaseSession(null)
      setUserEmail(null)
      setIsReady(true)
      return
    }

    const client = cloudStatus.client

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
  }, [cloudStatus, mode])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const handleStorage = (event: StorageEvent) => {
      if (!event.key) return

      if (event.key === 'supabaseUrl' || event.key === 'supabaseAnon' || event.key === 'cloud:disabled') {
        refreshCloudStatus()
      }
    }

    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener('storage', handleStorage)
    }
  }, [refreshCloudStatus])

  const login = useCallback(
    async (identifier: string, password: string) => {
      if (mode === 'supabase') {
        const cloud = getCloud()

        if (!cloud.ok) {
          throw new Error(cloud.reason)
        }

        const { error } = await cloud.client.auth.signInWithPassword({
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
      const cloud = getCloud()
      if (cloud.ok) {
        const { error } = await cloud.client.auth.signOut()
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
  const cloudReady = !SAFE_MODE && cloudStatus.ok
  const cloudError = SAFE_MODE ? 'Cloud disabled (safe mode)' : cloudStatus.ok ? null : cloudStatus.reason

  const value = useMemo(
    () => ({
      isAuthenticated,
      isReady,
      login,
      logout,
      mode,
      userEmail,
      refreshCloudStatus,
      cloudReady,
      cloudError,
      safeMode: SAFE_MODE,
    }),
    [cloudError, cloudReady, isAuthenticated, isReady, login, logout, mode, refreshCloudStatus, userEmail],
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
