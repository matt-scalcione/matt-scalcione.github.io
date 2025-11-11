import type { EstateId } from '../types/estate'
import { isLocalStorageAvailable } from './safeStorage'

const STORAGE_PREFIX = 'estate:sync:workspace'

const storageAvailable = () => isLocalStorageAvailable()

const keyForEstate = (estateId: EstateId) => `${STORAGE_PREFIX}:${estateId}`

export const getWorkspaceSyncTimestamp = (estateId: EstateId): string | null => {
  if (!storageAvailable()) return null
  try {
    return window.localStorage.getItem(keyForEstate(estateId))
  } catch (error) {
    console.warn('Unable to read sync timestamp', error)
    return null
  }
}

export const setWorkspaceSyncTimestamp = (estateId: EstateId, iso: string | null) => {
  if (!storageAvailable()) return
  try {
    const key = keyForEstate(estateId)
    if (!iso) {
      window.localStorage.removeItem(key)
    } else {
      window.localStorage.setItem(key, iso)
    }
  } catch (error) {
    console.warn('Unable to persist sync timestamp', error)
  }
}

export const clearAllWorkspaceSyncTimestamps = () => {
  if (!storageAvailable()) return
  try {
    const keys: string[] = []
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i)
      if (key && key.startsWith(`${STORAGE_PREFIX}:`)) {
        keys.push(key)
      }
    }
    for (const key of keys) {
      window.localStorage.removeItem(key)
    }
  } catch (error) {
    console.warn('Unable to clear sync timestamps', error)
  }
}
