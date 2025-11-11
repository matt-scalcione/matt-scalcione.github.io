import type { EstateId } from '../types/estate'
import type { BuyoutWorksheetData } from '../types/buyout'
import { isLocalStorageAvailable } from './safeStorage'

const STORAGE_PREFIX = 'estate-buyout-worksheet'

const storageAvailable = () => isLocalStorageAvailable()

const keyFor = (estateId: EstateId) => `${STORAGE_PREFIX}-${estateId}`

const cloneData = (data: BuyoutWorksheetData): BuyoutWorksheetData => ({
  appraisedValue: data.appraisedValue ?? '',
  sharePercent: data.sharePercent ?? '50',
  credits: Array.isArray(data.credits) ? data.credits.map((item) => ({ ...item })) : [],
  adjustments: Array.isArray(data.adjustments) ? data.adjustments.map((item) => ({ ...item })) : [],
})

export const loadBuyoutWorksheet = (estateId: EstateId): BuyoutWorksheetData => {
  if (!storageAvailable()) {
    return cloneData({
      appraisedValue: '',
      sharePercent: '50',
      credits: [],
      adjustments: [],
    })
  }

  try {
    const raw = window.localStorage.getItem(keyFor(estateId))
    if (!raw) {
      return cloneData({
        appraisedValue: '',
        sharePercent: '50',
        credits: [],
        adjustments: [],
      })
    }
    const parsed = JSON.parse(raw) as BuyoutWorksheetData
    return cloneData(parsed)
  } catch (error) {
    console.error('Failed to read buyout worksheet data', error)
    return cloneData({
      appraisedValue: '',
      sharePercent: '50',
      credits: [],
      adjustments: [],
    })
  }
}

export const saveBuyoutWorksheet = (estateId: EstateId, data: BuyoutWorksheetData) => {
  if (!storageAvailable()) return

  try {
    window.localStorage.setItem(keyFor(estateId), JSON.stringify(data))
  } catch (error) {
    console.error('Failed to persist buyout worksheet data', error)
  }
}

export const clearBuyoutWorksheet = (estateId: EstateId) => {
  if (!storageAvailable()) return

  try {
    window.localStorage.removeItem(keyFor(estateId))
  } catch (error) {
    console.error('Failed to clear buyout worksheet data', error)
  }
}
