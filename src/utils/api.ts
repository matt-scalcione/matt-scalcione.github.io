export type RuntimeConfig = {
  apiBaseUrl?: string
}

type FetchRetryOptions = {
  retries?: number
  retryDelayMs?: number
}

const DEFAULT_RETRY_ATTEMPTS = 2
const DEFAULT_RETRY_DELAY_MS = 750

const wait = (duration: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, duration)
  })

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '')

const resolveRuntimeConfig = (): RuntimeConfig => {
  if (typeof window === 'undefined') {
    return {}
  }

  const config = (window as typeof window & { __APP_CONFIG__?: RuntimeConfig }).__APP_CONFIG__
  if (config && typeof config === 'object') {
    return config
  }

  return {}
}

const resolveApiBaseUrl = () => {
  const env = (import.meta as unknown as { env?: Record<string, unknown> }).env
  const value = env?.VITE_API_BASE_URL
  if (typeof value === 'string' && value.trim().length > 0) {
    return trimTrailingSlash(value.trim())
  }

  const runtime = resolveRuntimeConfig()
  if (runtime.apiBaseUrl && runtime.apiBaseUrl.trim().length > 0) {
    return trimTrailingSlash(runtime.apiBaseUrl.trim())
  }

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3001'
    }
  }

  return ''
}

export const API_BASE_URL = resolveApiBaseUrl()

export const buildApiUrl = (path: string) => {
  if (!path.startsWith('/')) {
    throw new Error('API paths must start with a leading slash')
  }

  if (!API_BASE_URL) {
    return path
  }

  return `${API_BASE_URL}${path}`
}

const shouldRetry = (error: unknown) => {
  if (!error) {
    return false
  }
  if (error instanceof TypeError) {
    return true
  }
  return false
}

export const fetchWithRetry = async (
  input: RequestInfo | URL,
  init?: RequestInit,
  options: FetchRetryOptions = {}
) => {
  const { retries = DEFAULT_RETRY_ATTEMPTS, retryDelayMs = DEFAULT_RETRY_DELAY_MS } = options
  let attempt = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fetch(input, init)
    } catch (error) {
      if (attempt >= retries || !shouldRetry(error)) {
        throw error
      }
      attempt += 1
      await wait(retryDelayMs)
    }
  }
}
