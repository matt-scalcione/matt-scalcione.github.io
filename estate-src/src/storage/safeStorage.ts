const TEST_KEY = '__estate_storage_test__'

let hasWarned = false

export const isLocalStorageAvailable = (): boolean => {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    const storage = window.localStorage
    if (!storage) {
      return false
    }

    storage.setItem(TEST_KEY, '1')
    storage.removeItem(TEST_KEY)
    return true
  } catch (error) {
    if (!hasWarned) {
      console.warn('Local storage is not available; falling back to in-memory defaults.', error)
      hasWarned = true
    }
    return false
  }
}
