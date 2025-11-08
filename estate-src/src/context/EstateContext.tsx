import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { EstateId, EstateProfile } from '../types/estate'
import {
  ESTATE_IDS,
  getActiveEstateId,
  loadEstateProfiles,
  setActiveEstateId as persistActiveEstateId,
} from '../storage/estatePlan'

interface EstateContextValue {
  activeEstateId: EstateId
  estateProfiles: Record<EstateId, EstateProfile>
  setActiveEstateId: (estateId: EstateId) => void
  refreshEstateProfiles: () => void
}

const EstateContext = createContext<EstateContextValue | undefined>(undefined)

interface EstateProviderProps {
  children: ReactNode
}

export const EstateProvider = ({ children }: EstateProviderProps) => {
  const [activeEstateId, setActiveEstateIdState] = useState<EstateId>(() => getActiveEstateId())
  const [estateProfiles, setEstateProfiles] = useState<Record<EstateId, EstateProfile>>(() =>
    loadEstateProfiles(),
  )

  const setActiveEstateId = useCallback((id: EstateId) => {
    setActiveEstateIdState(id)
    persistActiveEstateId(id)
  }, [])

  const refreshEstateProfiles = useCallback(() => {
    setEstateProfiles(loadEstateProfiles())
  }, [])

  const value = useMemo<EstateContextValue>(
    () => ({ activeEstateId, estateProfiles, setActiveEstateId, refreshEstateProfiles }),
    [activeEstateId, estateProfiles, refreshEstateProfiles, setActiveEstateId],
  )

  return <EstateContext.Provider value={value}>{children}</EstateContext.Provider>
}

export const useEstate = () => {
  const context = useContext(EstateContext)
  if (!context) {
    throw new Error('useEstate must be used within an EstateProvider')
  }
  return context
}

export const useEstateProfilesList = () => {
  const { estateProfiles } = useEstate()
  return ESTATE_IDS.map((id) => estateProfiles[id])
}
