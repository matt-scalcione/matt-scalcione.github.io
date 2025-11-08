import type { EstateId } from './estate'

export interface BuyoutLineItem {
  id: string
  description: string
  amount: string
}

export interface BuyoutWorksheetData {
  estateId?: EstateId
  appraisedValue: string
  sharePercent: string
  credits: BuyoutLineItem[]
  adjustments: BuyoutLineItem[]
}
