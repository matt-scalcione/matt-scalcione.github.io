import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import {
  REMEMBER_STORAGE_KEY,
  authenticate,
  clearRememberToken,
  clearSession,
  persistRememberToken,
  readRememberToken,
  readSession,
  setSession
} from '../auth'

const IDLE_TIMEOUT_MS = 30 * 60 * 1000

interface AuthContextValue {
  isAuthenticated: boolean
  initializing: boolean
  rememberDevice: boolean
  login: (username: string, password: string, remember: boolean) => Promise<boolean>
  logout: () => void
  setRememberDevice: (enabled: boolean) => Promise<void>
}

const defaultAuthContext: AuthContextValue = {
  isAuthenticated: false,
  initializing: true,
  rememberDevice: false,
  login: async () => false,
  logout: () => {},
  setRememberDevice: async () => {}
}

const AuthContext = createContext<AuthContextValue>(defaultAuthContext)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setAuthenticated] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [rememberDevice, setRememberDeviceState] = useState<boolean>(() =>
    typeof window !== 'undefined' ? !!localStorage.getItem(REMEMBER_STORAGE_KEY) : false
  )
  const idleTimerRef = useRef<number | null>(null)

  const clearIdleTimer = () => {
    if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
  }

  const scheduleIdleTimer = useCallback(() => {
    clearIdleTimer()
    idleTimerRef.current = window.setTimeout(() => {
      setAuthenticated(false)
      clearSession()
      clearRememberToken()
    }, IDLE_TIMEOUT_MS)
  }, [])

  const attachActivityListeners = useCallback(() => {
    const reset = () => {
      if (!isAuthenticated) return
      scheduleIdleTimer()
    }
    window.addEventListener('mousemove', reset)
    window.addEventListener('keydown', reset)
    window.addEventListener('touchstart', reset)
    return () => {
      window.removeEventListener('mousemove', reset)
      window.removeEventListener('keydown', reset)
      window.removeEventListener('touchstart', reset)
    }
  }, [isAuthenticated, scheduleIdleTimer])

  useEffect(() => {
    const detach = attachActivityListeners()
    return () => {
      detach()
      clearIdleTimer()
    }
  }, [attachActivityListeners])

  useEffect(() => {
    let mounted = true
    const bootstrap = async () => {
      try {
        const session = readSession()
        if (session) {
          setAuthenticated(true)
          scheduleIdleTimer()
          return
        }
        const remembered = await readRememberToken()
        if (mounted && remembered) {
          setAuthenticated(true)
          setRememberDeviceState(true)
          scheduleIdleTimer()
        }
      } finally {
        if (mounted) {
          setInitializing(false)
        }
      }
    }
    void bootstrap()
    return () => {
      mounted = false
    }
  }, [scheduleIdleTimer])

  useEffect(() => {
    if (isAuthenticated) {
      scheduleIdleTimer()
    } else {
      clearIdleTimer()
    }
  }, [isAuthenticated, scheduleIdleTimer])

  const login: AuthContextValue['login'] = useCallback(
    async (username, password, remember) => {
      const valid = await authenticate(username, password)
      if (!valid) {
        return false
      }
      setSession()
      setAuthenticated(true)
      scheduleIdleTimer()
      if (remember) {
        await persistRememberToken()
        setRememberDeviceState(true)
      } else {
        clearRememberToken()
        setRememberDeviceState(false)
      }
      return true
    },
    [scheduleIdleTimer]
  )

  const logout = useCallback(() => {
    setAuthenticated(false)
    clearSession()
    clearRememberToken()
    setRememberDeviceState(false)
  }, [])

  const setRememberDevice: AuthContextValue['setRememberDevice'] = useCallback(
    async (enabled) => {
      setRememberDeviceState(enabled)
      if (!enabled) {
        clearRememberToken()
        return
      }
      if (isAuthenticated) {
        await persistRememberToken()
      }
    },
    [isAuthenticated]
  )

  const value = useMemo<AuthContextValue>(
    () => ({ isAuthenticated, initializing, rememberDevice, login, logout, setRememberDevice }),
    [isAuthenticated, initializing, rememberDevice, login, logout, setRememberDevice]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
