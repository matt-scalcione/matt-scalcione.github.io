import { ChangeEvent, FormEvent, useMemo, useState } from 'react'
import { FaCloudUploadAlt } from 'react-icons/fa'
import { useDataContext } from '../contexts/useDataContext'
import { DocumentRecord } from '../types'
import { formatDate } from '../utils/dates'

interface DocumentFormState {
  id?: string
  title: string
  description: string
  category: string
  tags: string
  notes: string
  file?: File | null
  dataUrl?: string
  fileName?: string
  fileType?: string
}

const emptyForm: DocumentFormState = {
  title: '',
  description: '',
  category: '',
  tags: '',
  notes: '',
  file: null
}

export const DocumentsPage = () => {
  const {
    data: { documents },
    addDocument,
    updateDocument,
    removeDocument
  } = useDataContext()

  const [form, setForm] = useState<DocumentFormState>(emptyForm)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')

  const categories = Array.from(new Set(documents.map((doc) => doc.category).filter(Boolean))) as string[]

  const filteredDocuments = useMemo(() => {
    const query = search.toLowerCase()
    return documents.filter((doc) => {
      const matchesSearch =
        !query ||
        doc.title.toLowerCase().includes(query) ||
        (doc.description ?? '').toLowerCase().includes(query) ||
        doc.tags.join(' ').toLowerCase().includes(query)
      const matchesCategory = !filterCategory || doc.category === filterCategory
      return matchesSearch && matchesCategory
    })
  }, [documents, search, filterCategory])

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const dataUrl = await readFileAsDataUrl(file)
    setForm((prev) => ({ ...prev, file, dataUrl, fileName: file.name, fileType: file.type }))
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!form.title.trim()) return

    const payload: Omit<DocumentRecord, 'id' | 'uploadedAt'> = {
      title: form.title,
      description: form.description.trim() || undefined,
      category: form.category || undefined,
      tags: form.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      notes: form.notes.trim() || undefined,
      dataUrl: form.dataUrl ?? '',
      fileName: form.fileName ?? form.title,
      fileType: form.fileType ?? 'application/octet-stream'
    }

    if (form.id) {
      updateDocument(form.id, payload)
    } else {
      addDocument(payload)
    }
    setForm(emptyForm)
  }

  const handleEdit = (doc: DocumentRecord) => {
    setForm({
      id: doc.id,
      title: doc.title,
      description: doc.description ?? '',
      category: doc.category ?? '',
      tags: doc.tags.join(', '),
      notes: doc.notes ?? '',
      dataUrl: doc.dataUrl,
      fileName: doc.fileName,
      fileType: doc.fileType
    })
  }

  const handlePreview = (doc: DocumentRecord) => {
    const win = window.open()
    if (!win) return
    win.document.write(`<iframe src="${doc.dataUrl}" title="${doc.title}" style="width:100%;height:100%"></iframe>`)
  }

  return (
    <div className="page documents">
      <section className="card">
        <div className="section-header">
          <h2>{form.id ? 'Update Document' : 'Upload Document'}</h2>
        </div>
        <form className="form grid" onSubmit={handleSubmit}>
          <label>
            <span>Title</span>
            <input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} required />
          </label>
          <label>
            <span>Description</span>
            <textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} rows={3} />
          </label>
          <label>
            <span>Category</span>
            <input value={form.category} onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))} />
          </label>
          <label>
            <span>Tags (comma separated)</span>
            <input value={form.tags} onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))} />
          </label>
          <label>
            <span>Notes</span>
            <textarea value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} rows={3} />
          </label>
          <label className="file-input">
            <span>File</span>
            <input
              type="file"
              onChange={(event) => {
                void handleFileChange(event)
              }}
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.txt"
            />
            {form.fileName && <p className="help">Current file: {form.fileName}</p>}
          </label>
          <div className="form-actions">
            <button type="submit" className="btn primary">
              <FaCloudUploadAlt /> {form.id ? 'Save changes' : 'Upload file'}
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <div className="section-header">
          <h2>Document Library</h2>
          <div className="actions">
            <input
              type="search"
              placeholder="Search documents"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select value={filterCategory} onChange={(event) => setFilterCategory(event.target.value)}>
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>
        {filteredDocuments.length === 0 ? (
          <p className="empty">No documents yet. Upload court filings, statements, and supporting records to keep them in one place.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Tags</th>
                <th>Uploaded</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocuments.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <strong>{doc.title}</strong>
                    {doc.description && <p>{doc.description}</p>}
                  </td>
                  <td>{doc.category ?? 'Uncategorized'}</td>
                  <td>{doc.tags.join(', ')}</td>
                  <td>{formatDate(doc.uploadedAt)}</td>
                  <td>
                    <div className="table-actions">
                      <button type="button" className="btn link" onClick={() => handlePreview(doc)}>
                        Preview
                      </button>
                      <a className="btn link" href={doc.dataUrl} download={doc.fileName}>
                        Download
                      </a>
                      <button type="button" className="btn link" onClick={() => handleEdit(doc)}>
                        Edit
                      </button>
                      <button type="button" className="btn link danger" onClick={() => removeDocument(doc.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
