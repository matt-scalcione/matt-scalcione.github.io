export type RuntimeConfig = {
  apiBaseUrl?: string
}

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
