export interface EstateSetup {
  dateOfDeath: string
  lettersGranted: string
  firstPublication?: string | null
  estate1041Required: boolean
}

const STORAGE_KEY = 'estate_setup_v1'

export const loadEstateSetup = (): EstateSetup | null => {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as EstateSetup
    return {
      dateOfDeath: parsed.dateOfDeath,
      lettersGranted: parsed.lettersGranted,
      firstPublication: parsed.firstPublication || null,
      estate1041Required:
        typeof parsed.estate1041Required === 'boolean' ? parsed.estate1041Required : true,
    }
  } catch (error) {
    console.warn('Unable to parse estate setup from storage', error)
    return null
  }
}

export const saveEstateSetup = (setup: EstateSetup) => {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(setup))
  } catch (error) {
    console.warn('Unable to persist estate setup', error)
  }
}

export const clearEstateSetup = () => {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.warn('Unable to clear estate setup', error)
  }
}
