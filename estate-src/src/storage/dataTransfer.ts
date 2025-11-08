import { db, type DocumentRecord, type JournalEntryRecord, type TaskRecord } from './tasksDB'
import { type EstateSetup, clearEstateSetup, loadEstateSetup, saveEstateSetup } from './setup'

const EXPORT_VERSION = 1

export type ExportedDocumentRecord = Omit<DocumentRecord, 'file'> & {
  fileData: string
}

export interface WorkspaceExportPayload {
  version: number
  generatedAt: string
  tasks: TaskRecord[]
  documents: ExportedDocumentRecord[]
  journalEntries: JournalEntryRecord[]
  estateSetup: EstateSetup | null
}

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Unable to read file data'))
      }
    }
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read file data'))
    reader.readAsDataURL(blob)
  })

const dataUrlToBlob = (dataUrl: string): Blob => {
  const [metadata, data] = dataUrl.split(',')
  if (!metadata || !data) {
    throw new Error('Invalid file data')
  }

  const mimeStart = metadata.indexOf(':')
  const mimeEnd = metadata.indexOf(';')
  const contentType =
    mimeStart !== -1 && mimeEnd !== -1
      ? metadata.slice(mimeStart + 1, mimeEnd)
      : 'application/octet-stream'

  if (metadata.includes(';base64')) {
    const binary = atob(data)
    const array = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) {
      array[i] = binary.charCodeAt(i)
    }
    return new Blob([array], { type: contentType })
  }

  return new Blob([decodeURIComponent(data)], { type: contentType })
}

export const exportWorkspaceData = async (): Promise<WorkspaceExportPayload> => {
  const [tasks, documents, journalEntries] = await Promise.all([
    db.tasks.toArray(),
    db.documents.toArray(),
    db.journalEntries.toArray(),
  ])

  const exportedDocuments: ExportedDocumentRecord[] = await Promise.all(
    documents.map(async (doc) => ({
      id: doc.id,
      title: doc.title,
      tags: doc.tags,
      taskId: doc.taskId,
      contentType: doc.contentType,
      size: doc.size,
      created_at: doc.created_at,
      fileData: await blobToDataUrl(doc.file),
    })),
  )

  return {
    version: EXPORT_VERSION,
    generatedAt: new Date().toISOString(),
    tasks: tasks.map((task) => ({ ...task })),
    documents: exportedDocuments,
    journalEntries: journalEntries.map((entry) => ({ ...entry })),
    estateSetup: loadEstateSetup(),
  }
}

export const clearWorkspaceData = async () => {
  await db.transaction('rw', db.tasks, db.documents, db.journalEntries, async () => {
    await Promise.all([db.tasks.clear(), db.documents.clear(), db.journalEntries.clear()])
  })
  clearEstateSetup()
}

export const importWorkspaceData = async (payload: WorkspaceExportPayload) => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid workspace data')
  }

  if (payload.version !== EXPORT_VERSION) {
    throw new Error('Unsupported export version')
  }

  const reconstructedDocs: DocumentRecord[] = payload.documents.map((doc) => {
    const fileBlob = dataUrlToBlob(doc.fileData)
    return {
      id: doc.id,
      title: doc.title,
      tags: doc.tags,
      taskId: doc.taskId,
      contentType: doc.contentType,
      size: fileBlob.size,
      file: fileBlob,
      created_at: doc.created_at,
    }
  })

  await db.transaction('rw', db.tasks, db.documents, db.journalEntries, async () => {
    await Promise.all([db.tasks.clear(), db.documents.clear(), db.journalEntries.clear()])
    await db.tasks.bulkAdd(payload.tasks.map((task) => ({ ...task })))
    if (reconstructedDocs.length > 0) {
      await db.documents.bulkAdd(reconstructedDocs)
    }
    if (payload.journalEntries.length > 0) {
      await db.journalEntries.bulkAdd(payload.journalEntries.map((entry) => ({ ...entry })))
    }
  })

  if (payload.estateSetup) {
    saveEstateSetup(payload.estateSetup)
  } else {
    clearEstateSetup()
  }
}
