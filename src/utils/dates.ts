import dayjs from 'dayjs'
import { AutoScheduleKey, EstateInfo } from '../types'

type DeadlineMap = Partial<Record<AutoScheduleKey, string | undefined>>

export const calculateDeadlines = (info: EstateInfo): DeadlineMap => {
  const deadlines: DeadlineMap = {}
  if (info.lettersGrantedDate) {
    deadlines.heirNotice = dayjs(info.lettersGrantedDate).add(3, 'month').toISOString()
  }
  if (info.dateOfDeath) {
    deadlines.inventoryDue = dayjs(info.dateOfDeath).add(9, 'month').toISOString()
    deadlines.inheritanceTax = dayjs(info.dateOfDeath).add(9, 'month').toISOString()
    deadlines.inheritanceTaxDiscount = dayjs(info.dateOfDeath).add(3, 'month').toISOString()
  }
  if (info.firstAdvertisementDate) {
    deadlines.creditorBar = dayjs(info.firstAdvertisementDate).add(1, 'year').toISOString()
  }
  return deadlines
}

export const formatDate = (value?: string, fallback = ''): string =>
  value ? dayjs(value).format('MMM D, YYYY') : fallback

export const isOverdue = (value?: string): boolean =>
  !!value && dayjs(value).isBefore(dayjs(), 'day')

export const isDueSoon = (value?: string, days = 14): boolean =>
  !!value && dayjs(value).isAfter(dayjs().subtract(1, 'day')) && dayjs(value).isBefore(dayjs().add(days, 'day'))
