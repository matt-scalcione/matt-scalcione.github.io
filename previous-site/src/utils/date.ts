import dayjs from 'dayjs'
import advancedFormat from 'dayjs/plugin/advancedFormat'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import isoWeek from 'dayjs/plugin/isoWeek'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import { CalendarEvent, DeadlineSummary, EstateProfile, Task } from '../types'

dayjs.extend(advancedFormat)
dayjs.extend(localizedFormat)
dayjs.extend(isoWeek)
dayjs.extend(isSameOrAfter)
dayjs.extend(isSameOrBefore)

export const formatDate = (value?: string | null, fallback = '—') => {
  if (!value) return fallback
  const parsed = dayjs(value)
  if (!parsed.isValid()) return fallback
  return parsed.format('MMM D, YYYY')
}

export const formatDateInput = (value?: string | null) => {
  if (!value) return ''
  const parsed = dayjs(value)
  if (!parsed.isValid()) return ''
  return parsed.format('YYYY-MM-DD')
}

export const isDueSoon = (value?: string | null, days = 14) => {
  if (!value) return false
  const now = dayjs()
  const due = dayjs(value)
  if (!due.isValid()) return false
  return due.isSameOrAfter(now, 'day') && due.diff(now, 'day') <= days
}

export const isOverdue = (value?: string | null) => {
  if (!value) return false
  const now = dayjs()
  const due = dayjs(value)
  if (!due.isValid()) return false
  return due.isBefore(now, 'day')
}

export const calculateDeadlines = (profile?: EstateProfile | null): DeadlineSummary => {
  if (!profile) return {}
  const deadlines: DeadlineSummary = {}
  const letters = profile.lettersGrantedDate ? dayjs(profile.lettersGrantedDate) : null
  const dod = profile.dateOfDeath ? dayjs(profile.dateOfDeath) : null
  const firstAd = profile.firstAdvertisementDate ? dayjs(profile.firstAdvertisementDate) : null

  if (letters?.isValid()) {
    deadlines.rule105Notice = letters.add(3, 'month').format('YYYY-MM-DD')
    deadlines.certificationOfNotice = letters.add(3, 'month').add(10, 'day').format('YYYY-MM-DD')
  }
  if (dod?.isValid()) {
    deadlines.inventoryDue = dod.add(9, 'month').format('YYYY-MM-DD')
    deadlines.inheritanceTaxDue = dod.add(9, 'month').format('YYYY-MM-DD')
    deadlines.inheritanceTaxDiscount = dod.add(3, 'month').format('YYYY-MM-DD')
  }
  if (firstAd?.isValid()) {
    deadlines.creditorBarDate = firstAd.add(12, 'month').format('YYYY-MM-DD')
  }
  return deadlines
}

export const buildCalendarEvents = (
  tasks: Task[],
  deadlines: DeadlineSummary
): CalendarEvent[] => {
  const events: CalendarEvent[] = []
  tasks
    .filter((task) => task.dueDate)
    .forEach((task) => {
      events.push({
        id: `task-${task.id}`,
        title: task.title,
        date: task.dueDate as string,
        type: 'Task',
        status: task.status,
        referenceId: task.id
      })
    })

  const deadlineEntries = [
    ['Rule 10.5 heir notices due', deadlines.rule105Notice],
    ['Certification of Notice filing', deadlines.certificationOfNotice],
    ['Inventory filing due', deadlines.inventoryDue],
    ['Inheritance tax return due', deadlines.inheritanceTaxDue],
    ['Inheritance tax 5% discount deadline', deadlines.inheritanceTaxDiscount],
    ['Creditor claim bar date', deadlines.creditorBarDate]
  ] as const

  deadlineEntries.forEach(([title, date], index) => {
    if (!date) return
    events.push({
      id: `deadline-${index}`,
      title,
      date,
      type: 'Deadline'
    })
  })

  return events.sort((a, b) => a.date.localeCompare(b.date))
}

export const getUpcomingEvents = (events: CalendarEvent[], horizonDays = 90) => {
  const now = dayjs()
  const horizon = now.add(horizonDays, 'day')
  return events.filter((event) => {
    const eventDate = dayjs(event.date)
    if (!eventDate.isValid()) return false
    return eventDate.isSameOrAfter(now, 'day') && eventDate.isSameOrBefore(horizon, 'day')
  })
}

export const buildMonthMatrix = (reference: dayjs.Dayjs) => {
  const start = reference.startOf('month').startOf('week')
  const weeks: dayjs.Dayjs[][] = []
  let current = start
  for (let week = 0; week < 6; week += 1) {
    const days: dayjs.Dayjs[] = []
    for (let day = 0; day < 7; day += 1) {
      days.push(current)
      current = current.add(1, 'day')
    }
    weeks.push(days)
  }
  return weeks
}
