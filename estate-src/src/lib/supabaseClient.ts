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

const validateCredentials = (url: string, anonKey: string): string | null => {
  if (!url || !anonKey) {
    return 'Missing Supabase URL or anon key'
  }

  if (!/^https?:\/\//i.test(url)) {
    return 'Supabase URL must start with http(s)://'
  }

  if (anonKey.length < 40) {
    return 'Anon key looks too short'
  }

  return null
}

const buildClient = (url: string, anonKey: string): SupabaseClient =>
  createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  })

export function getClient(): SupabaseClient | null {
  const url = resolveUrl()
  const anonKey = resolveAnonKey()
  const validationError = validateCredentials(url, anonKey)

  if (validationError) {
    resetCache()
    return null
  }

  if (cachedStatus?.ok && cachedUrl === url && cachedAnonKey === anonKey) {
    return cachedStatus.client
  }

  try {
    const client = buildClient(url, anonKey)
    cachedStatus = { ok: true, client }
    cachedUrl = url
    cachedAnonKey = anonKey
    return client
  } catch (error) {
    console.error('Supabase init failed', error)
    resetCache()
    return null
  }
}

export async function getUserId(client?: SupabaseClient): Promise<string | null> {
  const resolvedClient = client ?? getClient()
  if (!resolvedClient) return null

  try {
    const { data, error } = await resolvedClient.auth.getUser()
    if (error) {
      console.warn('Unable to read Supabase user', error)
      return null
    }
    return data.user?.id ?? null
  } catch (error) {
    console.warn('Unexpected Supabase user lookup error', error)
    return null
  }
}

export function getCloud(): CloudStatus {
  const url = resolveUrl()
  const anonKey = resolveAnonKey()

  const validationError = validateCredentials(url, anonKey)
  if (validationError) {
    resetCache()
    return { ok: false, reason: validationError }
  }

  if (cachedStatus?.ok && cachedUrl === url && cachedAnonKey === anonKey) {
    return cachedStatus
  }

  try {
    const client = buildClient(url, anonKey)
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
