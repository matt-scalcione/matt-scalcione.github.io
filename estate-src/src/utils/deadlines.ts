import { EstateSetup } from '../storage/setup'

export type DeadlineKey =
  | 'noticeToHeirs'
  | 'inventory'
  | 'inheritanceTax'
  | 'inheritanceTaxEarlyWindow'
  | 'final1040'
  | 'estate1041'
  | 'creditorCheck'
  | 'statusReport'

export interface DeadlineItem {
  key: DeadlineKey
  title: string
  dueDate: Date | null
  tag: 'Tax' | 'Legal' | 'Inventory' | 'Administrative'
  description?: string
  optional?: boolean
}

const parseDateInput = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day, 12))
}

const addMonths = (date: Date, months: number) => {
  const result = new Date(date.getTime())
  const day = result.getUTCDate()
  result.setUTCDate(1)
  result.setUTCMonth(result.getUTCMonth() + months)
  const daysInTargetMonth = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate()
  result.setUTCDate(Math.min(day, daysInTargetMonth))
  return result
}

export const isSetupComplete = (setup: EstateSetup | null): setup is EstateSetup => {
  return Boolean(setup?.dateOfDeath && setup?.lettersGranted)
}

export const prepareSetupDates = (setup: EstateSetup) => {
  return {
    dateOfDeath: parseDateInput(setup.dateOfDeath),
    lettersGranted: parseDateInput(setup.lettersGranted),
    firstPublication: setup.firstPublication ? parseDateInput(setup.firstPublication) : null,
  }
}

const nextApril15 = (date: Date) => {
  const nextYear = date.getUTCFullYear() + 1
  return new Date(Date.UTC(nextYear, 3, 15, 12))
}

export const computeDeadlines = (setup: EstateSetup): DeadlineItem[] => {
  const { dateOfDeath, lettersGranted, firstPublication } = prepareSetupDates(setup)

  const inheritanceTaxDue = addMonths(dateOfDeath, 9)
  const inheritanceTaxEarlyWindow = addMonths(dateOfDeath, 3)

  const items: DeadlineItem[] = [
    {
      key: 'noticeToHeirs',
      title: 'Notice to heirs',
      dueDate: addMonths(lettersGranted, 3),
      tag: 'Legal',
      description: 'Serve statutory notice to heirs; file certification within 10 days after notices are sent.',
    },
    {
      key: 'inventory',
      title: 'File estate inventory',
      dueDate: addMonths(dateOfDeath, 9),
      tag: 'Inventory',
    },
    {
      key: 'inheritanceTax',
      title: 'PA inheritance tax return (REV-1500)',
      dueDate: inheritanceTaxDue,
      tag: 'Tax',
      description: `Standard payment deadline. Early payment discount window ends ${inheritanceTaxEarlyWindow.toLocaleDateString(
        undefined,
        {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        },
      )}.`,
    },
    {
      key: 'final1040',
      title: 'Final Form 1040',
      dueDate: nextApril15(dateOfDeath),
      tag: 'Tax',
    },
    {
      key: 'estate1041',
      title: 'Estate Form 1041',
      dueDate: setup.estate1041Required ? nextApril15(dateOfDeath) : null,
      tag: 'Tax',
      optional: true,
      description: 'Confirm whether an estate income tax return is required. Mark as N/A if the estate has no filing obligation.',
    },
    {
      key: 'creditorCheck',
      title: 'Creditor claims check',
      dueDate: firstPublication ? addMonths(firstPublication, 12) : null,
      tag: 'Administrative',
      description: firstPublication
        ? undefined
        : 'Enter the first publication date to calculate the creditor claim deadline.',
    },
    {
      key: 'statusReport',
      title: 'Status report to court',
      dueDate: addMonths(dateOfDeath, 24),
      tag: 'Administrative',
    },
  ]

  items.push({
    key: 'inheritanceTaxEarlyWindow',
    title: 'REV-1500 early payment window ends',
    dueDate: inheritanceTaxEarlyWindow,
    tag: 'Tax',
    description: 'Last day to submit payment for the 5% Pennsylvania discount.',
  })

  return items
}

export const formatDeadlineDate = (date: Date | null) => {
  if (!date) return 'N/A'
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export const toISODateString = (date: Date) => date.toISOString()
