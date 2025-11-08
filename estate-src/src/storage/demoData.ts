import { type EstateSetup, saveEstateSetup } from './setup'
import { db, type DocumentRecord, type JournalEntryRecord, type TaskRecord } from './tasksDB'

const addDays = (date: Date, days: number) => {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

const createDemoDataset = () => {
  const today = new Date()
  const iso = (value: Date) => value.toISOString()

  const estateSetup: EstateSetup = {
    dateOfDeath: iso(addDays(today, -180)).slice(0, 10),
    lettersGranted: iso(addDays(today, -150)).slice(0, 10),
    firstPublication: iso(addDays(today, -140)).slice(0, 10),
    estate1041Required: true,
  }

  const tasks: TaskRecord[] = [
    {
      id: 'task-demo-letters',
      title: 'Share letters testamentary with advisors',
      description:
        'Send certified copies of the letters testamentary to the investment advisor and accountant so they can speak with custodians on behalf of the estate.',
      due_date: iso(addDays(today, 3)),
      status: 'in-progress',
      priority: 'med',
      tags: ['Legal', 'Administrative'],
      docIds: ['doc-demo-letters'],
      created_at: iso(addDays(today, -20)),
      updated_at: iso(addDays(today, -2)),
    },
    {
      id: 'task-demo-inventory',
      title: 'Compile preliminary inventory of assets',
      description:
        'Collect latest statements and valuations for cash accounts, securities, real estate, and personal property to inform the court inventory.',
      due_date: iso(addDays(today, -4)),
      status: 'not-started',
      priority: 'high',
      tags: ['Inventory'],
      docIds: ['doc-demo-inventory'],
      created_at: iso(addDays(today, -28)),
      updated_at: iso(addDays(today, -10)),
    },
    {
      id: 'task-demo-tax',
      title: 'Schedule estimated tax payments',
      description:
        'Coordinate with the accountant to project fiduciary income tax and ensure estimated payments are calendared ahead of Form 1041 deadlines.',
      due_date: iso(addDays(today, 18)),
      status: 'not-started',
      priority: 'med',
      tags: ['Tax'],
      docIds: [],
      created_at: iso(addDays(today, -16)),
      updated_at: iso(addDays(today, -16)),
    },
    {
      id: 'task-demo-distributions',
      title: 'Document interim family meeting',
      description:
        'Summarize distribution priorities, questions, and follow-ups after the latest family status meeting.',
      due_date: iso(addDays(today, 32)),
      status: 'done',
      priority: 'low',
      tags: ['Administrative'],
      docIds: [],
      created_at: iso(addDays(today, -8)),
      updated_at: iso(addDays(today, -1)),
    },
  ]

  const lettersBlob = new Blob(
    [
      'Accountant and investment advisor copied on letters testamentary. Include authority to transact with custodians for all brokerage accounts. Ensure copies remain on file with date stamps.',
    ],
    { type: 'text/plain' },
  )

  const inventoryBlob = new Blob(
    [
      'Preliminary asset inventory drafted. Outstanding: December bank statements, updated valuation for lake house, personal property photo catalog.',
    ],
    { type: 'text/plain' },
  )

  const documents: DocumentRecord[] = [
    {
      id: 'doc-demo-letters',
      title: 'Letters testamentary summary',
      tags: ['Legal'],
      taskId: 'task-demo-letters',
      contentType: 'text/plain',
      size: lettersBlob.size,
      file: lettersBlob,
      created_at: iso(addDays(today, -19)),
    },
    {
      id: 'doc-demo-inventory',
      title: 'Inventory working notes',
      tags: ['Inventory'],
      taskId: 'task-demo-inventory',
      contentType: 'text/plain',
      size: inventoryBlob.size,
      file: inventoryBlob,
      created_at: iso(addDays(today, -15)),
    },
  ]

  const journalEntries: JournalEntryRecord[] = [
    {
      id: 'journal-demo-weekly',
      title: 'Weekly status recap',
      body: 'Met with the family to review creditor notices and shared the updated cash flow summary. Need to confirm outstanding medical reimbursements and finalize inventory draft next week.',
      created_at: iso(addDays(today, -6)),
    },
    {
      id: 'journal-demo-notes',
      title: 'Questions for counsel',
      body: 'Clarify whether ancillary probate is required for the Colorado property and confirm plan for distributing specific bequests listed in the memorandum.',
      created_at: iso(addDays(today, -2)),
    },
  ]

  return { estateSetup, tasks, documents, journalEntries }
}

export const resetDemoData = async () => {
  const { estateSetup, tasks, documents, journalEntries } = createDemoDataset()

  await db.transaction('rw', db.tasks, db.documents, db.journalEntries, async () => {
    await Promise.all([db.tasks.clear(), db.documents.clear(), db.journalEntries.clear()])
    await db.tasks.bulkAdd(tasks)
    await db.documents.bulkAdd(documents)
    await db.journalEntries.bulkAdd(journalEntries)
  })

  saveEstateSetup(estateSetup)
}
