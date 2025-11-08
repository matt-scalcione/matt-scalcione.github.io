import { createContext } from 'react'
import type { DataContextValue } from './DataContext.types'

export const DataContext = createContext<DataContextValue | undefined>(undefined)
