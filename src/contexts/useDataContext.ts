import { useContext } from 'react'
import { DataContext } from './DataContextBase'

export const useDataContext = () => {
  const context = useContext(DataContext)
  if (!context) {
    throw new Error('useDataContext must be used within DataProvider')
  }
  return context
}
