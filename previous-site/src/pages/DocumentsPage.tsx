import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFileArrowDown, faTrash, faEye, faFilePdf, faImage, faFile } from '@fortawesome/free-solid-svg-icons'
import { useDataContext } from '../context/DataContext'
import { formatDate } from '../utils/date'
import { DocumentRecord, DocumentTag } from '../types'

const tagOptions: DocumentTag[] = ['Legal', 'Tax', 'Property', 'Receipts', 'Bank', 'ID', 'Other']

export const DocumentsPage = () => {
  const { documents, addDocument, deleteDocument, getDocumentBlob } = useDataContext()
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [tags, setTags] = useState<DocumentTag[]>(['Legal'])
  const [notes, setNotes] = useState('')
  const [search, setSearch] = useState('')
  const [selectedDoc, setSelectedDoc] = useState<DocumentRecord | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const filteredDocuments = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return documents
    return documents.filter((doc) => {
      const haystack = `${doc.title ?? ''} ${doc.filename} ${doc.tags.join(' ')}`.toLowerCase()
      return haystack.includes(term)
    })
  }, [documents, search])

  useEffect(() => {
    let active = true
    let url: string | null = null
    if (!selectedDoc) {
      setPreviewUrl(null)
      return
    }
    void (async () => {
      const blob = await getDocumentBlob(selectedDoc.blobRef)
      if (!active) return
      if (blob) {
        url = URL.createObjectURL(blob)
        setPreviewUrl(url)
      } else {
        setPreviewUrl(null)
      }
    })()
    return () => {
      active = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [selectedDoc, getDocumentBlob])

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0]
    setFile(nextFile ?? null)
    if (nextFile && !title) {
      setTitle(nextFile.name)
    }
  }

  const toggleTag = (tag: DocumentTag) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]))
  }

  const handleUpload = async (event: FormEvent) => {
    event.preventDefault()
    if (!file) return
    await addDocument(file, { title: title.trim() || undefined, tags, notes: notes.trim() || undefined })
    setFile(null)
    setTitle('')
    setTags(['Legal'])
    setNotes('')
  }

  const handleDownload = async (doc: DocumentRecord) => {
    const blob = await getDocumentBlob(doc.blobRef)
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = doc.filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  const currentPreviewIcon = selectedDoc?.mimeType.includes('image')
    ? faImage
    : selectedDoc?.mimeType === 'application/pdf'
    ? faFilePdf
    : faFile

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr,3fr]">
      <section className="space-y-6">
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">Upload documents</h2>
          </div>
          <form className="card-body space-y-4" onSubmit={handleUpload}>
            <div>
              <label className="label" htmlFor="documentFile">
                File
              </label>
              <input
                id="documentFile"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.csv,.txt"
                onChange={handleFileChange}
                className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-brand-500 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="documentTitle">
                Title (optional)
              </label>
              <input
                id="documentTitle"
                className="input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Affidavit of publication"
              />
            </div>
            <div>
              <label className="label">Tags</label>
              <div className="flex flex-wrap gap-2">
                {tagOptions.map((tag) => (
                  <button
                    type="button"
                    key={tag}
                    className={clsx(
                      'rounded-full px-3 py-1 text-xs font-semibold shadow-sm',
                      tags.includes(tag)
                        ? 'bg-brand-500 text-white'
                        : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    )}
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label" htmlFor="documentNotes">
                Notes
              </label>
              <textarea
                id="documentNotes"
                className="input"
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Filed with Register of Wills on…"
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={!file}>
              Upload document
            </button>
          </form>
        </div>
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">Search</h2>
          </div>
          <div className="card-body">
            <input
              className="input"
              placeholder="Search by filename, title, or tag"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">Document library</h2>
            <p className="text-sm text-slate-500">{documents.length} files stored securely in your browser.</p>
          </div>
          <div className="card-body space-y-3">
            {filteredDocuments.length === 0 && <p className="text-sm text-slate-500">No documents yet.</p>}
            {filteredDocuments.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <FontAwesomeIcon
                    icon={doc.mimeType.includes('image') ? faImage : doc.mimeType === 'application/pdf' ? faFilePdf : faFile}
                    className="text-brand-500"
                  />
                  <div>
                    <p className="font-medium text-slate-800 dark:text-slate-100">{doc.title ?? doc.filename}</p>
                    <p className="text-xs text-slate-500">Uploaded {formatDate(doc.createdAt)}</p>
                    <div className="mt-1 flex flex-wrap gap-1 text-[10px] uppercase tracking-wide text-slate-500">
                      {doc.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-slate-200 px-2 py-0.5 dark:bg-slate-800">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <button type="button" className="text-brand-600 hover:underline" onClick={() => setSelectedDoc(doc)}>
                    <FontAwesomeIcon icon={faEye} className="mr-1" /> Preview
                  </button>
                  <button type="button" className="text-brand-600 hover:underline" onClick={() => void handleDownload(doc)}>
                    <FontAwesomeIcon icon={faFileArrowDown} className="mr-1" /> Download
                  </button>
                  <button type="button" className="text-rose-500 hover:underline" onClick={() => void deleteDocument(doc.id)}>
                    <FontAwesomeIcon icon={faTrash} className="mr-1" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card min-h-[300px]">
          <div className="card-header">
            <h2 className="text-lg font-semibold">Preview</h2>
          </div>
          <div className="card-body min-h-[240px]">
            {selectedDoc ? (
              previewUrl && selectedDoc.mimeType === 'application/pdf' ? (
                <embed src={previewUrl} type="application/pdf" className="h-64 w-full rounded-lg border border-slate-200 dark:border-slate-700" />
              ) : previewUrl && selectedDoc.mimeType.startsWith('image/') ? (
                <img src={previewUrl} alt={selectedDoc.title ?? selectedDoc.filename} className="h-64 w-full rounded-lg object-contain" />
              ) : (
                <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-500 dark:border-slate-700">
                  <FontAwesomeIcon icon={currentPreviewIcon} className="mb-2 text-2xl text-brand-500" />
                  <p>No inline preview available. Use download to view the file.</p>
                </div>
              )
            ) : (
              <p className="text-sm text-slate-500">Select a document to preview.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
