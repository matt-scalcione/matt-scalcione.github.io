import { FormEvent, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { FaPlus } from 'react-icons/fa'
import { useDataContext } from '../contexts/useDataContext'
import { AssetRecord } from '../types'
import { formatDate } from '../utils/dates'

interface AssetFormState {
  id?: string
  name: string
  category: string
  ownerStatus: string
  probateStatus: 'probate' | 'non-probate'
  taxable: boolean
  value: string
  notes: string
  dispositionStatus: 'held' | 'sold' | 'distributed'
  dispositionDate: string
  dispositionDetails: string
  attachedDocumentIds: string[]
}

const emptyForm: AssetFormState = {
  name: '',
  category: '',
  ownerStatus: '',
  probateStatus: 'probate',
  taxable: true,
  value: '',
  notes: '',
  dispositionStatus: 'held',
  dispositionDate: '',
  dispositionDetails: '',
  attachedDocumentIds: []
}

const categories = [
  'Real Estate',
  'Bank Account',
  'Investment Account',
  'Retirement Account',
  'Vehicle',
  'Life Insurance',
  'Personal Property',
  'Business Interest',
  'Other'
]

export const AssetsPage = () => {
  const {
    data: { assets, documents },
    addAsset,
    updateAsset,
    removeAsset
  } = useDataContext()

  const [form, setForm] = useState<AssetFormState>(emptyForm)
  const [filterCategory, setFilterCategory] = useState('')

  const filteredAssets = useMemo(
    () => assets.filter((asset) => !filterCategory || asset.category === filterCategory),
    [assets, filterCategory]
  )

  const totalValue = assets.reduce((sum, asset) => sum + (asset.value ?? 0), 0)
  const taxableValue = assets.filter((asset) => asset.taxable).reduce((sum, asset) => sum + (asset.value ?? 0), 0)
  const probateValue = assets.filter((asset) => asset.probateStatus === 'probate').reduce((sum, asset) => sum + (asset.value ?? 0), 0)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!form.name.trim()) return

    const payload: Omit<AssetRecord, 'id'> = {
      name: form.name,
      category: form.category,
      ownerStatus: form.ownerStatus,
      probateStatus: form.probateStatus,
      taxable: form.taxable,
      value: form.value ? Number(form.value) : undefined,
      notes: form.notes || undefined,
      attachedDocumentIds: form.attachedDocumentIds,
      disposition:
        form.dispositionStatus === 'held'
          ? undefined
          : {
              status: form.dispositionStatus,
              date: form.dispositionDate || undefined,
              details: form.dispositionDetails || undefined
            }
    }

    if (form.id) {
      updateAsset(form.id, payload)
    } else {
      addAsset(payload)
    }
    setForm(emptyForm)
  }

  const handleEdit = (asset: AssetRecord) => {
    setForm({
      id: asset.id,
      name: asset.name,
      category: asset.category,
      ownerStatus: asset.ownerStatus,
      probateStatus: asset.probateStatus,
      taxable: asset.taxable,
      value: asset.value?.toString() ?? '',
      notes: asset.notes ?? '',
      dispositionStatus: asset.disposition?.status ?? 'held',
      dispositionDate: asset.disposition?.date ? dayjs(asset.disposition.date).format('YYYY-MM-DD') : '',
      dispositionDetails: asset.disposition?.details ?? '',
      attachedDocumentIds: asset.attachedDocumentIds
    })
  }

  return (
    <div className="page assets">
      <section className="card">
        <div className="section-header">
          <h2>{form.id ? 'Update Asset' : 'Add Asset'}</h2>
        </div>
        <form className="form grid" onSubmit={handleSubmit}>
          <label>
            <span>Asset name / description</span>
            <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required />
          </label>
          <label>
            <span>Category</span>
            <select value={form.category} onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}>
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Owner status</span>
            <input value={form.ownerStatus} onChange={(event) => setForm((prev) => ({ ...prev, ownerStatus: event.target.value }))} placeholder="Sole owner, joint, beneficiary designated" />
          </label>
          <label>
            <span>Probate vs non-probate</span>
            <select value={form.probateStatus} onChange={(event) => setForm((prev) => ({ ...prev, probateStatus: event.target.value as AssetFormState['probateStatus'] }))}>
              <option value="probate">Probate asset</option>
              <option value="non-probate">Non-probate asset</option>
            </select>
          </label>
          <label>
            <span>Subject to inheritance tax?</span>
            <select value={form.taxable ? 'yes' : 'no'} onChange={(event) => setForm((prev) => ({ ...prev, taxable: event.target.value === 'yes' }))}>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          <label>
            <span>Value (date of death)</span>
            <input type="number" min="0" step="0.01" value={form.value} onChange={(event) => setForm((prev) => ({ ...prev, value: event.target.value }))} />
          </label>
          <label>
            <span>Notes</span>
            <textarea value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} rows={3} placeholder="Valuation source, account number reference, etc." />
          </label>
          <label>
            <span>Disposition</span>
            <select value={form.dispositionStatus} onChange={(event) => setForm((prev) => ({ ...prev, dispositionStatus: event.target.value as AssetFormState['dispositionStatus'] }))}>
              <option value="held">Still held</option>
              <option value="sold">Sold</option>
              <option value="distributed">Distributed to beneficiary</option>
            </select>
          </label>
          {form.dispositionStatus !== 'held' && (
            <>
              <label>
                <span>Disposition date</span>
                <input type="date" value={form.dispositionDate} onChange={(event) => setForm((prev) => ({ ...prev, dispositionDate: event.target.value }))} />
              </label>
              <label>
                <span>Disposition details</span>
                <textarea value={form.dispositionDetails} onChange={(event) => setForm((prev) => ({ ...prev, dispositionDetails: event.target.value }))} rows={3} />
              </label>
            </>
          )}
          <label>
            <span>Attach documents</span>
            <select
              multiple
              value={form.attachedDocumentIds}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  attachedDocumentIds: Array.from(event.target.selectedOptions).map((option) => option.value)
                }))
              }
            >
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title}
                </option>
              ))}
            </select>
          </label>
          <div className="form-actions">
            <button type="submit" className="btn primary">
              <FaPlus /> {form.id ? 'Save changes' : 'Add asset'}
            </button>
            {form.id && (
              <button type="button" className="btn" onClick={() => setForm(emptyForm)}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="card">
        <div className="section-header">
          <h2>Asset Inventory</h2>
          <div className="actions">
            <select value={filterCategory} onChange={(event) => setFilterCategory(event.target.value)}>
              <option value="">All categories</option>
              {categories
                .filter((category) => assets.some((asset) => asset.category === category))
                .map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
            </select>
            <div className="inventory-totals">
              <span>Total estate value: ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              <span>Probate assets: ${probateValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              <span>Taxable base: ${taxableValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
          </div>
        </div>
        {filteredAssets.length === 0 ? (
          <p className="empty">Log real property, accounts, investments, and personal property to prepare the official inventory.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Category</th>
                <th>Probate?</th>
                <th>Taxable?</th>
                <th>Value</th>
                <th>Disposition</th>
                <th>Documents</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.map((asset) => (
                <tr key={asset.id}>
                  <td>
                    <strong>{asset.name}</strong>
                    {asset.notes && <p>{asset.notes}</p>}
                    <p className="meta-item">Owner: {asset.ownerStatus || 'n/a'}</p>
                  </td>
                  <td>{asset.category}</td>
                  <td>{asset.probateStatus === 'probate' ? 'Yes' : 'No'}</td>
                  <td>{asset.taxable ? 'Yes' : 'No'}</td>
                  <td>{asset.value ? `$${asset.value.toLocaleString()}` : 'n/a'}</td>
                  <td>
                    {asset.disposition ? (
                      <div>
                        <span className="meta-item">{asset.disposition.status}</span>
                        {asset.disposition.date && <p>{formatDate(asset.disposition.date)}</p>}
                        {asset.disposition.details && <p>{asset.disposition.details}</p>}
                      </div>
                    ) : (
                      <span className="meta-item">Held</span>
                    )}
                  </td>
                  <td>
                    {asset.attachedDocumentIds.length === 0 ? (
                      <span className="meta-item">None</span>
                    ) : (
                      <ul>
                        {asset.attachedDocumentIds.map((docId) => {
                          const doc = documents.find((item) => item.id === docId)
                          return doc ? <li key={doc.id}>{doc.title}</li> : null
                        })}
                      </ul>
                    )}
                  </td>
                  <td>
                    <div className="table-actions">
                      <button type="button" className="btn link" onClick={() => handleEdit(asset)}>
                        Edit
                      </button>
                      <button type="button" className="btn link danger" onClick={() => removeAsset(asset.id)}>
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
