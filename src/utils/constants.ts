import dayjs from 'dayjs'
import { AutoScheduleKey, Task } from '../types'

export const STORAGE_KEY = 'estate-executor-dashboard-data-v1'
export const SESSION_KEY = 'estate-executor-dashboard-session'

export const PASSWORD_HASH = 'c1bf7aa95df384dd61f576e37526bb4fdc8b6e8a0c08fb45b85dda9f3b629b25'
export const CHECKLIST_SEEDED_KEY = 'estate-executor-checklist-seeded'

interface TemplateTask extends Omit<Task, 'id' | 'createdAt' | 'updatedAt'> {
  autoSchedule?: AutoScheduleKey
}

const baseTasks: TemplateTask[] = [
  {
    title: 'Secure property and personal belongings',
    description:
      'Change locks if necessary, safeguard valuables, and document the condition of real and personal property.',
    category: 'Property Maintenance',
    tags: ['Property', 'Initial Steps'],
    status: 'todo'
  },
  {
    title: 'Open estate bank account',
    description: 'Establish a dedicated estate checking account for all incoming and outgoing funds.',
    category: 'Financial',
    tags: ['Financial'],
    status: 'todo'
  },
  {
    title: 'Publish estate notice in approved publications',
    description:
      'Advertise the estate notice in a legal journal and local newspaper to start the one-year creditor claim period.',
    category: 'Legal Filing',
    tags: ['Legal'],
    status: 'todo'
  },
  {
    title: 'Send formal Notice of Estate Administration to heirs',
    description: 'Deliver Rule 10.5 notices to all known heirs within three months of appointment.',
    category: 'Communication',
    tags: ['Legal Filing', 'Communication'],
    status: 'todo',
    autoSchedule: 'heirNotice'
  },
  {
    title: 'File Inventory of estate assets',
    description: 'Prepare and submit the Inventory to the Register of Wills within nine months of date of death.',
    category: 'Legal Filing',
    tags: ['Inventory', 'Legal'],
    status: 'todo',
    autoSchedule: 'inventoryDue'
  },
  {
    title: 'File Pennsylvania inheritance tax return',
    description:
      'File Form REV-1500 and pay inheritance tax within nine months of date of death (5% discount if paid within three months).',
    category: 'Tax',
    tags: ['Tax'],
    status: 'todo',
    autoSchedule: 'inheritanceTax'
  },
  {
    title: 'Consider early inheritance tax payment for discount',
    description: 'Pay inheritance tax within three months of death to take advantage of the 5% discount.',
    category: 'Tax',
    tags: ['Tax', 'Planning'],
    status: 'todo',
    autoSchedule: 'inheritanceTaxDiscount'
  },
  {
    title: 'Track end of creditor claim period',
    description: 'Mark one year from first advertisement date as the close of the creditor claim window.',
    category: 'Legal Filing',
    tags: ['Legal'],
    status: 'todo',
    autoSchedule: 'creditorBar'
  },
  {
    title: 'Pay outstanding estate bills and obligations',
    description: 'Review and pay utilities, medical bills, credit cards, and other liabilities.',
    category: 'Financial',
    tags: ['Financial'],
    status: 'todo'
  },
  {
    title: 'Prepare final accounting and plan distributions',
    description: 'Compile transactions, obtain releases if appropriate, and distribute estate assets to beneficiaries.',
    category: 'Closing',
    tags: ['Legal', 'Financial'],
    status: 'todo'
  }
]

export const defaultTasks = (): Task[] =>
  baseTasks.map((task) => ({
    ...task,
    id: crypto.randomUUID(),
    createdAt: dayjs().toISOString(),
    updatedAt: dayjs().toISOString()
  }))
