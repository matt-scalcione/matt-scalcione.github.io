import Dexie, { Table } from 'dexie'
import {
  AssetRecord,
  BeneficiaryRecord,
  DocumentBlob,
  DocumentRecord,
  ExpenseRecord,
  KeyValueRecord,
  Task
} from './types'

export class EstateDatabase extends Dexie {
  tasks!: Table<Task, string>
  documents!: Table<DocumentRecord, string>
  documentBlobs!: Table<DocumentBlob, string>
  assets!: Table<AssetRecord, string>
  expenses!: Table<ExpenseRecord, string>
  beneficiaries!: Table<BeneficiaryRecord, string>
  kv!: Table<KeyValueRecord, string>

  constructor() {
    super('estateExecutorDB')
    this.version(1).stores({
      tasks: '&id, createdAt, status, dueDate, category, templateKey',
      documents: '&id, createdAt, tags',
      documentBlobs: '&id',
      assets: '&id, createdAt, category',
      expenses: '&id, date, category, createdAt',
      beneficiaries: '&id, createdAt, name',
      kv: '&key'
    })
  }
}

export const db = new EstateDatabase()
