import dayjs from 'dayjs'
import { TaskCategory, Task } from '../types'
import { calculateDeadlines } from '../utils/date'
import { EstateProfile } from '../types'

interface ChecklistTemplate {
  key: string
  title: string
  description?: string
  category: TaskCategory
  tags: string[]
  due: (profile: EstateProfile, index?: number) => string | undefined
}

const weeksFrom = (start?: string, weeks = 0) => {
  if (!start) return undefined
  const base = dayjs(start)
  if (!base.isValid()) return undefined
  return base.add(weeks, 'week').format('YYYY-MM-DD')
}

const checklistTemplates: ChecklistTemplate[] = [
  {
    key: 'lawReporterNotice-1',
    title: 'Publish estate notice (Chester County Law Reporter) – week 1',
    category: 'Legal',
    tags: ['Notice'],
    due: (profile) => profile.firstAdvertisementDate || undefined
  },
  {
    key: 'lawReporterNotice-2',
    title: 'Publish estate notice (Chester County Law Reporter) – week 2',
    category: 'Legal',
    tags: ['Notice'],
    due: (profile) => weeksFrom(profile.firstAdvertisementDate, 1)
  },
  {
    key: 'lawReporterNotice-3',
    title: 'Publish estate notice (Chester County Law Reporter) – week 3',
    category: 'Legal',
    tags: ['Notice'],
    due: (profile) => weeksFrom(profile.firstAdvertisementDate, 2)
  },
  {
    key: 'newspaperNotice-1',
    title: 'Publish estate notice (newspaper of general circulation) – week 1',
    category: 'Legal',
    tags: ['Notice'],
    due: (profile) => profile.firstAdvertisementDate || undefined
  },
  {
    key: 'newspaperNotice-2',
    title: 'Publish estate notice (newspaper of general circulation) – week 2',
    category: 'Legal',
    tags: ['Notice'],
    due: (profile) => weeksFrom(profile.firstAdvertisementDate, 1)
  },
  {
    key: 'newspaperNotice-3',
    title: 'Publish estate notice (newspaper of general circulation) – week 3',
    category: 'Legal',
    tags: ['Notice'],
    due: (profile) => weeksFrom(profile.firstAdvertisementDate, 2)
  },
  {
    key: 'affidavits',
    title: 'Obtain & file affidavits of publication',
    category: 'Legal',
    tags: ['Notice'],
    due: (profile) => weeksFrom(profile.firstAdvertisementDate, 5)
  },
  {
    key: 'rule105',
    title: 'Rule 10.5 heir notices – mail to heirs',
    category: 'Comms',
    tags: ['Heirs'],
    due: (profile) => {
      const deadlines = calculateDeadlines(profile)
      return deadlines.rule105Notice
    }
  },
  {
    key: 'certificationNotice',
    title: 'File Certification of Notice with Register of Wills',
    category: 'Legal',
    tags: ['Heirs'],
    due: (profile) => {
      const deadlines = calculateDeadlines(profile)
      return deadlines.certificationOfNotice
    }
  },
  {
    key: 'ein',
    title: 'Obtain EIN for the estate',
    category: 'Financial',
    tags: ['Setup'],
    due: () => undefined
  },
  {
    key: 'bankAccount',
    title: 'Open estate bank account and deposit incoming checks',
    category: 'Financial',
    tags: ['Banking'],
    due: () => undefined
  },
  {
    key: 'secureProperty',
    title: 'Secure and preserve property (insurance, utilities, locks)',
    category: 'Property',
    tags: ['Property'],
    due: () => undefined
  },
  {
    key: 'assetInventory',
    title: 'Conduct asset inventory (capture date-of-death values)',
    category: 'Property',
    tags: ['Inventory'],
    due: (profile) => {
      const deadlines = calculateDeadlines(profile)
      return deadlines.inventoryDue
    }
  },
  {
    key: 'inventoryFiling',
    title: 'File inventory with Register of Wills',
    category: 'Legal',
    tags: ['Inventory'],
    due: (profile) => {
      const deadlines = calculateDeadlines(profile)
      return deadlines.inventoryDue
    }
  },
  {
    key: 'inheritanceTax',
    title: 'Prepare and file PA inheritance tax return',
    category: 'Tax',
    tags: ['Tax'],
    due: (profile) => {
      const deadlines = calculateDeadlines(profile)
      return deadlines.inheritanceTaxDue
    }
  },
  {
    key: 'inheritanceTaxDiscount',
    title: 'Optional 5% discount if tax paid within 3 months',
    category: 'Tax',
    tags: ['Tax'],
    due: (profile) => {
      const deadlines = calculateDeadlines(profile)
      return deadlines.inheritanceTaxDiscount
    }
  },
  {
    key: 'creditorBar',
    title: 'Creditor bar date checkpoint',
    category: 'Legal',
    tags: ['Creditors'],
    due: (profile) => {
      const deadlines = calculateDeadlines(profile)
      return deadlines.creditorBarDate
    }
  },
  {
    key: 'finalAccounting',
    title: 'Final accounting & distribution; close estate',
    category: 'Financial',
    tags: ['Closing'],
    due: () => undefined
  }
]

export const buildChecklistTasks = (
  profile: EstateProfile,
  nowIso: string
): Array<Omit<Task, 'id' | 'assignedTo' | 'relatedIds'>> => {
  return checklistTemplates.map((template) => ({
    templateKey: template.key,
    title: template.title,
    description: template.description,
    category: template.category,
    tags: template.tags,
    status: 'Todo' as const,
    dueDate: template.due(profile),
    createdAt: nowIso,
    updatedAt: nowIso
  }))
}

