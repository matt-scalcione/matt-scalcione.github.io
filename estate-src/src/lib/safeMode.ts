const getSafeModeFromEnv = () => {
  if (typeof window === 'undefined') return false
  try {
    const qs = new URLSearchParams(window.location.search)
    if (qs.get('safe') === '1') return true
    return window.localStorage.getItem('cloud:disabled') === '1'
  } catch (error) {
    console.warn('Unable to determine safe mode status', error)
    return false
  }
}

export const SAFE_MODE = getSafeModeFromEnv()

export const disableCloud = () => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem('cloud:disabled', '1')
}

export const enableCloud = () => {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem('cloud:disabled')
}

