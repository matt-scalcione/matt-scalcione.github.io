import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'

const STORAGE_URL_KEY = 'estate:supabaseUrl'
const STORAGE_ANON_KEY = 'estate:supabaseAnonKey'
const AUTH_STORAGE_KEY = 'estate.supabase.auth'

type SupabaseConfig = {
  url: string
  anonKey: string
}

let cachedClient: SupabaseClient | null = null
let cachedConfig: SupabaseConfig | null = null

const readLocalStorage = (key: string): string | null => {
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage.getItem(key)
  } catch (error) {
    console.warn('Unable to read Supabase config from storage', error)
    return null
  }
}

const writeLocalStorage = (key: string, value: string | null) => {
  if (typeof window === 'undefined') return

  try {
    if (value) {
      window.localStorage.setItem(key, value)
    } else {
      window.localStorage.removeItem(key)
    }
  } catch (error) {
    console.warn('Unable to persist Supabase config', error)
  }
}

const resolveConfig = (): SupabaseConfig | null => {
  const overrideUrl = readLocalStorage(STORAGE_URL_KEY)
  const overrideKey = readLocalStorage(STORAGE_ANON_KEY)

  const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const envAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

  const url = (overrideUrl ?? envUrl ?? '').trim()
  const anonKey = (overrideKey ?? envAnonKey ?? '').trim()

  if (!url || !anonKey) {
    return null
  }

  return { url, anonKey }
}

export const hasSupabaseConfig = () => Boolean(resolveConfig())

export const getSupabaseOverrides = () => ({
  url: (readLocalStorage(STORAGE_URL_KEY) ?? '').trim(),
  anonKey: (readLocalStorage(STORAGE_ANON_KEY) ?? '').trim(),
})

export const saveSupabaseOverrides = (url: string, anonKey: string) => {
  writeLocalStorage(STORAGE_URL_KEY, url.trim() || null)
  writeLocalStorage(STORAGE_ANON_KEY, anonKey.trim() || null)
  cachedClient = null
  cachedConfig = null
}

const createSupabaseClient = (config: SupabaseConfig) =>
  createClient(config.url, config.anonKey, {
    auth: {
      storageKey: AUTH_STORAGE_KEY,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  })

export const getClient = (): SupabaseClient | null => {
  const config = resolveConfig()
  if (!config) {
    return null
  }

  if (cachedClient && cachedConfig) {
    if (cachedConfig.url === config.url && cachedConfig.anonKey === config.anonKey) {
      return cachedClient
    }
  }

  cachedClient = createSupabaseClient(config)
  cachedConfig = config
  return cachedClient
}

export const getUserId = async (): Promise<string | null> => {
  const client = getClient()
  if (!client) {
    return null
  }

  try {
    const { data, error } = await client.auth.getUser()
    if (error) {
      console.warn('Unable to fetch Supabase user', error)
      return null
    }

    return data.user?.id ?? null
  } catch (error) {
    console.warn('Unexpected Supabase error', error)
    return null
  }
}

export const getSupabaseSession = async (): Promise<Session | null> => {
  const client = getClient()
  if (!client) {
    return null
  }

  try {
    const { data, error } = await client.auth.getSession()
    if (error) {
      console.warn('Unable to read Supabase session', error)
      return null
    }

    return data.session ?? null
  } catch (error) {
    console.warn('Unexpected Supabase error', error)
    return null
  }
}

