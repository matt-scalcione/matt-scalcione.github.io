const USERNAME = 'matt'
const PASSWORD_REFERENCE = '1A0uS7fO3z+Frqt1M2+PAYxhLWSMI601EvalwkW9KXM='
const PBKDF2_SALT = 'estate-app-v1'
const PBKDF2_ITERATIONS = 200_000
const PBKDF2_KEY_LENGTH = 32
export const SESSION_STORAGE_KEY = 'estate_auth'
export const REMEMBER_STORAGE_KEY = 'estate_remember_token'
const REMEMBER_HMAC_SECRET = 'estate-remember-secret-v1'

export interface SessionState {
  establishedAt: number
}

const encoder = new TextEncoder()

const toBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

const constantTimeCompare = (a: string, b: string) => {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

const derivePassword = async (password: string) => {
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits'
  ])
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: encoder.encode(PBKDF2_SALT),
      iterations: PBKDF2_ITERATIONS
    },
    keyMaterial,
    PBKDF2_KEY_LENGTH * 8
  )
  return toBase64(derivedBits)
}

export const authenticate = async (username: string, password: string) => {
  if (username !== USERNAME) return false
  const derived = await derivePassword(password)
  return constantTimeCompare(derived, PASSWORD_REFERENCE)
}

export const setSession = () => {
  const payload: SessionState = { establishedAt: Date.now() }
  sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload))
}

export const clearSession = () => {
  sessionStorage.removeItem(SESSION_STORAGE_KEY)
  localStorage.removeItem(REMEMBER_STORAGE_KEY)
}

export const readSession = (): SessionState | null => {
  const raw = sessionStorage.getItem(SESSION_STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as SessionState
    if (typeof parsed?.establishedAt === 'number') {
      return parsed
    }
  } catch (error) {
    console.warn('Failed to parse session state', error)
  }
  sessionStorage.removeItem(SESSION_STORAGE_KEY)
  return null
}

interface RememberTokenPayload {
  deviceId: string
  expiry: number
  signature: string
}

const signRememberToken = async (payload: string) => {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(REMEMBER_HMAC_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return toBase64(signature)
}

export const persistRememberToken = async (days = 30) => {
  const deviceId = crypto.randomUUID()
  const expiry = Date.now() + days * 24 * 60 * 60 * 1000
  const payload = `${deviceId}:${expiry}`
  const signature = await signRememberToken(payload)
  const record: RememberTokenPayload = { deviceId, expiry, signature }
  localStorage.setItem(REMEMBER_STORAGE_KEY, JSON.stringify(record))
}

export const clearRememberToken = () => {
  localStorage.removeItem(REMEMBER_STORAGE_KEY)
}

export const readRememberToken = async (): Promise<boolean> => {
  const raw = localStorage.getItem(REMEMBER_STORAGE_KEY)
  if (!raw) return false
  try {
    const parsed = JSON.parse(raw) as RememberTokenPayload
    if (typeof parsed?.deviceId !== 'string' || typeof parsed?.expiry !== 'number') {
      return false
    }
    if (parsed.expiry < Date.now()) {
      localStorage.removeItem(REMEMBER_STORAGE_KEY)
      return false
    }
    const payload = `${parsed.deviceId}:${parsed.expiry}`
    const expectedSignature = await signRememberToken(payload)
    if (!constantTimeCompare(parsed.signature ?? '', expectedSignature)) {
      localStorage.removeItem(REMEMBER_STORAGE_KEY)
      return false
    }
    setSession()
    return true
  } catch (error) {
    console.warn('Failed to read remember token', error)
    localStorage.removeItem(REMEMBER_STORAGE_KEY)
    return false
  }
}
