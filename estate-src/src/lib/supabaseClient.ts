import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const STORAGE_URL_KEY = 'supabaseUrl'
const STORAGE_ANON_KEY = 'supabaseAnon'

const readLocalStorage = (key: string) => {
  if (typeof window === 'undefined') return ''
  try {
    return window.localStorage.getItem(key) ?? ''
  } catch (error) {
    console.warn(`Unable to read ${key} from storage`, error)
    return ''
  }
}

const writeLocalStorage = (key: string, value: string | null) => {
  if (typeof window === 'undefined') return
  try {
    if (value && value.trim()) {
      window.localStorage.setItem(key, value.trim())
    } else {
      window.localStorage.removeItem(key)
    }
  } catch (error) {
    console.warn(`Unable to persist ${key} in storage`, error)
  }
}

const resolveUrl = () => {
  const override = readLocalStorage(STORAGE_URL_KEY)
  const envValue = import.meta.env.VITE_SUPABASE_URL as string | undefined
  return (override || envValue || '').trim()
}

const resolveAnonKey = () => {
  const override = readLocalStorage(STORAGE_ANON_KEY)
  const envValue = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  return (override || envValue || '').trim()
}

export type CloudStatus =
  | { ok: true; client: SupabaseClient }
  | { ok: false; reason: string }

let cachedStatus: CloudStatus | null = null
let cachedUrl = ''
let cachedAnonKey = ''

const resetCache = () => {
  cachedStatus = null
  cachedUrl = ''
  cachedAnonKey = ''
}

export const getSupabaseOverrides = () => ({
  url: readLocalStorage(STORAGE_URL_KEY).trim(),
  anonKey: readLocalStorage(STORAGE_ANON_KEY).trim(),
})

export const saveSupabaseOverrides = (url: string, anonKey: string) => {
  writeLocalStorage(STORAGE_URL_KEY, url)
  writeLocalStorage(STORAGE_ANON_KEY, anonKey)
  resetCache()
}

export const clearSupabaseOverrides = () => {
  writeLocalStorage(STORAGE_URL_KEY, null)
  writeLocalStorage(STORAGE_ANON_KEY, null)
  resetCache()
}

export function getCloud(): CloudStatus {
  try {
    const url = resolveUrl()
    const anonKey = resolveAnonKey()

    if (!url || !anonKey) {
      resetCache()
      return { ok: false, reason: 'Missing Supabase URL or anon key' }
    }

    if (!/^https?:\/\//i.test(url)) {
      return { ok: false, reason: 'Supabase URL must start with http(s)://' }
    }

    if (anonKey.length < 40) {
      return { ok: false, reason: 'Anon key looks too short' }
    }

    if (cachedStatus && cachedUrl === url && cachedAnonKey === anonKey) {
      return cachedStatus
    }

    const client = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    })

    cachedStatus = { ok: true, client }
    cachedUrl = url
    cachedAnonKey = anonKey
    return cachedStatus
  } catch (error) {
    console.error('Supabase init failed', error)
    resetCache()
    return { ok: false, reason: 'Supabase init failed' }
  }
}
