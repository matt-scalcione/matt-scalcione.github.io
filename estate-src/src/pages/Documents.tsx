import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { liveQuery, type Subscription } from 'dexie'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker?worker&url'
import {
  DocumentRecord,
  TaskRecord,
  createDocument,
  db,
  linkDocumentToTask,
  unlinkDocumentFromTask,
} from '../storage/tasksDB'

GlobalWorkerOptions.workerSrc = pdfWorker

const MAX_FILE_SIZE = 10 * 1024 * 1024

const formatBytes = (size: number) => {
  if (!size) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1)
  const value = size / 1024 ** exponent
  const formatted = exponent === 0 ? value.toFixed(0) : value.toFixed(1)
  return `${formatted} ${units[exponent]}`
}

const formatDateTime = (iso: string) => {
  if (!iso) return 'Unknown date'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const parseTags = (value: string) =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

const iconForDocument = (doc: DocumentRecord) => {
  if (doc.contentType.includes('pdf')) return '📄'
  if (doc.contentType.startsWith('image/')) return '🖼️'
  if (doc.contentType.includes('text')) return '📝'
  return '📦'
}

type DocumentPreviewModalProps = {
  doc: DocumentRecord | null
  onClose: () => void
  onDownload: (doc: DocumentRecord) => void
}

const DocumentPreviewModal = ({ doc, onClose, onDownload }: DocumentPreviewModalProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [textPreview, setTextPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!doc) return

    setImageUrl(null)
    setTextPreview(null)
    setError(null)
    setLoading(false)

    let objectUrl: string | null = null
    let cancelled = false
    let loadingTask: ReturnType<typeof getDocument> | null = null

    if (doc.contentType.startsWith('image/')) {
      objectUrl = URL.createObjectURL(doc.file)
      setImageUrl(objectUrl)
    } else if (doc.contentType.includes('pdf')) {
      const render = async () => {
        setLoading(true)
        try {
          const buffer = await doc.file.arrayBuffer()
          if (cancelled) return
          loadingTask = getDocument({ data: buffer })
          const pdf = await loadingTask.promise
          if (cancelled) return
          const page = await pdf.getPage(1)
          if (cancelled) return
          const viewport = page.getViewport({ scale: 1 })
          const desiredWidth = 600
          const scale = Math.min(2, desiredWidth / viewport.width)
          const scaledViewport = page.getViewport({ scale })
          const canvas = canvasRef.current
          if (!canvas) return
          const context = canvas.getContext('2d')
          if (!context) return
          canvas.height = scaledViewport.height
          canvas.width = scaledViewport.width
          await page.render({ canvasContext: context, viewport: scaledViewport }).promise
        } catch (err) {
          console.error(err)
          if (!cancelled) {
            setError('Unable to render PDF preview')
          }
        } finally {
          if (!cancelled) {
            setLoading(false)
          }
        }
      }

      render()
    } else if (doc.contentType.includes('text') || doc.contentType === 'text/plain') {
      const loadText = async () => {
        try {
          const content = await doc.file.text()
          if (!cancelled) {
            setTextPreview(content.slice(0, 4000))
          }
        } catch (err) {
          console.error(err)
          if (!cancelled) {
            setError('Unable to load text preview')
          }
        }
      }

      loadText()
    } else {
      setError('Preview not available for this file type.')
    }

    return () => {
      cancelled = true
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
      if (loadingTask) {
        loadingTask.destroy()
      }
    }
  }, [doc])

  if (!doc) return null

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/60 px-4 py-6">
      <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{doc.title || 'Untitled document'}</h2>
            <p className="text-sm text-slate-500">
              {doc.contentType || 'Unknown type'} • {formatBytes(doc.size)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onDownload(doc)}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-primary-200 hover:text-primary-600"
            >
              Download
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-primary-200 hover:text-primary-600"
            >
              Close
            </button>
          </div>
        </header>

        <div className="max-h-[70vh] overflow-auto">
          {doc.contentType.startsWith('image/') && imageUrl ? (
            <img
              src={imageUrl}
              alt={doc.title || 'Document preview'}
              className="mx-auto max-h-[60vh] rounded-lg object-contain"
            />
          ) : doc.contentType.includes('pdf') ? (
            error ? (
              <p className="text-sm text-rose-600">{error}</p>
            ) : (
              <div className="space-y-2">
                <canvas
                  ref={canvasRef}
                  className="mx-auto w-full max-w-full rounded-lg border border-slate-200 bg-slate-50"
                />
                {loading && <p className="text-center text-sm text-slate-500">Loading preview…</p>}
              </div>
            )
          ) : doc.contentType.includes('text') || doc.contentType === 'text/plain' ? (
            error ? (
              <p className="text-sm text-rose-600">{error}</p>
            ) : textPreview !== null ? (
              <pre className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                {textPreview}
              </pre>
            ) : (
              <p className="text-sm text-slate-500">Loading preview…</p>
            )
          ) : (
            <p className="text-sm text-slate-500">{error ?? 'Preview not available for this file type.'}</p>
          )}
        </div>
      </div>
    </div>
  )
}

const Documents = () => {
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [assignTaskId, setAssignTaskId] = useState('')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [tagFilter, setTagFilter] = useState('all')
  const [previewDoc, setPreviewDoc] = useState<DocumentRecord | null>(null)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [updatingDocId, setUpdatingDocId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    let isMounted = true
    let subscription: Subscription | undefined

    subscription = liveQuery(() => db.documents.toArray()).subscribe({
      next: (rows) => {
        if (!isMounted) return
        const ordered = [...rows].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        setDocuments(ordered)
      },
      error: (err) => {
        console.error(err)
        if (!isMounted) return
        setPageError('Unable to load documents')
      },
    })

    return () => {
      isMounted = false
      subscription?.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    let subscription: Subscription | undefined

    subscription = liveQuery(() => db.tasks.toArray()).subscribe({
      next: (rows) => {
        if (!isMounted) return
        const sorted = [...rows].sort(
          (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime(),
        )
        setTasks(sorted)
      },
      error: (err) => {
        console.error(err)
      },
    })

    return () => {
      isMounted = false
      subscription?.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const highlight = searchParams.get('highlight')
    if (highlight) {
      setHighlightedId(highlight)
    }
  }, [searchParams])

  useEffect(() => {
    const state = location.state as { startUpload?: boolean } | null
    if (!state?.startUpload) return

    setUploadError(null)

    const input = fileInputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null
    if (input) {
      if (typeof input.showPicker === 'function') {
        try {
          input.showPicker()
        } catch (err) {
          console.error(err)
          input.click()
        }
      } else {
        input.click()
      }
      input.focus()
    }

    navigate(location.pathname + location.search, { replace: true })
  }, [location, navigate])

  useEffect(() => {
    if (!highlightedId) return
    if (typeof window === 'undefined') return

    if (!documents.some((doc) => doc.id === highlightedId)) {
      setHighlightedId(null)
      return
    }

    const element = document.getElementById(`doc-${highlightedId}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const timeout = window.setTimeout(() => setHighlightedId(null), 4000)
      return () => window.clearTimeout(timeout)
    }
  }, [highlightedId, documents])

  const availableTags = useMemo(() => {
    const unique = new Set<string>()
    documents.forEach((doc) => doc.tags.forEach((tag) => unique.add(tag)))
    return Array.from(unique).sort((a, b) => a.localeCompare(b))
  }, [documents])

  const filteredDocuments = useMemo(() => {
    const term = searchTerm.toLowerCase().trim()
    return documents.filter((doc) => {
      if (tagFilter !== 'all' && !doc.tags.includes(tagFilter)) {
        return false
      }
      if (!term) return true
      const haystack = [
        doc.title,
        doc.contentType,
        ...doc.tags,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      const taskTitle = tasks.find((task) => task.id === doc.taskId)?.title.toLowerCase()
      return haystack.includes(term) || (!!taskTitle && taskTitle.includes(term))
    })
  }, [documents, tagFilter, searchTerm, tasks])

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null
    setFile(selected)
    setUploadError(null)
    if (selected) {
      const baseName = selected.name.replace(/\.[^.]+$/, '')
      setTitle(baseName)
    }
  }

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!file) {
      setUploadError('Select a file to upload')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setUploadError('File must be 10 MB or smaller')
      return
    }

    setUploadError(null)
    setPageError(null)
    setUploading(true)

    try {
      await createDocument({
        file,
        title: title.trim() || file.name,
        tags: parseTags(tagsInput),
        taskId: assignTaskId || null,
      })
      setFile(null)
      setTitle('')
      setTagsInput('')
      setAssignTaskId('')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err) {
      console.error(err)
      setUploadError('Unable to upload document')
    } finally {
      setUploading(false)
    }
  }

  const handleDownload = (doc: DocumentRecord) => {
    const objectUrl = URL.createObjectURL(doc.file)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = doc.title || 'document'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(objectUrl)
  }

  const handleReassign = async (doc: DocumentRecord, taskId: string) => {
    setPageError(null)
    setUpdatingDocId(doc.id)
    try {
      if (taskId) {
        await linkDocumentToTask(doc.id, taskId)
      } else {
        await unlinkDocumentFromTask(doc.id)
      }
    } catch (err) {
      console.error(err)
      setPageError('Unable to update document link')
    } finally {
      setUpdatingDocId(null)
    }
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900">Documents</h1>
        <p className="text-sm text-slate-500">
          Upload, organize, and preview estate planning documents. Files are stored locally in your browser for privacy.
        </p>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Upload a document</h2>
        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleUpload}>
          <div className="space-y-2">
            <label htmlFor="document-file" className="text-sm font-medium text-slate-700">
              File (PDF, JPG, PNG, TXT — max 10 MB)
            </label>
            <input
              id="document-file"
              name="document-file"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.txt"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="document-title" className="text-sm font-medium text-slate-700">
              Title
            </label>
            <input
              id="document-title"
              name="document-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="document-tags" className="text-sm font-medium text-slate-700">
              Tags (comma separated)
            </label>
            <input
              id="document-tags"
              name="document-tags"
              value={tagsInput}
              onChange={(event) => setTagsInput(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="document-task" className="text-sm font-medium text-slate-700">
              Link to task (optional)
            </label>
            <select
              id="document-task"
              name="document-task"
              value={assignTaskId}
              onChange={(event) => setAssignTaskId(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none"
            >
              <option value="">No linked task</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={uploading}
              className="rounded-full bg-primary-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {uploading ? 'Uploading…' : 'Upload document'}
            </button>
            {uploadError && <p className="text-sm text-rose-600">{uploadError}</p>}
          </div>
        </form>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px]">
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by title, tags, or task"
            className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none"
          />
        </div>
        <select
          value={tagFilter}
          onChange={(event) => setTagFilter(event.target.value)}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none"
        >
          <option value="all">All tags</option>
          {availableTags.map((tag) => (
            <option key={tag} value={tag}>
              #{tag}
            </option>
          ))}
        </select>
      </div>

      {pageError && <p className="text-sm text-rose-600">{pageError}</p>}

      {filteredDocuments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          <p>No documents found. Upload a file or adjust your filters.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredDocuments.map((doc) => {
            const assignedTask = tasks.find((task) => task.id === doc.taskId)
            const isHighlighted = highlightedId === doc.id
            return (
              <article
                key={doc.id}
                id={`doc-${doc.id}`}
                className={`flex h-full flex-col justify-between rounded-2xl border bg-white p-5 shadow-sm transition ${
                  isHighlighted ? 'border-primary-300 ring-2 ring-primary-200' : 'border-slate-200 hover:border-primary-200'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{iconForDocument(doc)}</span>
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold text-slate-900">
                        {doc.title || 'Untitled document'}
                      </h3>
                      <p className="text-xs text-slate-500">Uploaded {formatDateTime(doc.created_at)}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    {doc.contentType || 'Unknown type'} • {formatBytes(doc.size)}
                  </p>
                  {doc.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 text-xs font-medium">
                      {doc.tags.map((tag) => (
                        <button
                          type="button"
                          key={`${doc.id}-${tag}`}
                          onClick={() => setTagFilter(tag)}
                          className="rounded-full border border-slate-200 px-3 py-1 text-slate-600 transition hover:border-primary-200 hover:text-primary-600"
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">Linked task</label>
                    <select
                      value={doc.taskId ?? ''}
                      onChange={(event) => handleReassign(doc, event.target.value)}
                      disabled={updatingDocId === doc.id}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none"
                    >
                      <option value="">No linked task</option>
                      {tasks.map((task) => (
                        <option key={task.id} value={task.id}>
                          {task.title}
                        </option>
                      ))}
                    </select>
                    {assignedTask && (
                      <p className="text-xs text-slate-500">Linked to {assignedTask.title}</p>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewDoc(doc)}
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-primary-200 hover:text-primary-600"
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload(doc)}
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-primary-200 hover:text-primary-600"
                  >
                    Download
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} onDownload={handleDownload} />
    </section>
  )
}

export default Documents
