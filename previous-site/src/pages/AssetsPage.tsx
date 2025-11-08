import { FormEvent, useMemo, useState } from 'react'
import { useDataContext } from '../context/DataContext'
import { AssetCategory, AssetRecord } from '../types'

const categories: AssetCategory[] = ['RealEstate', 'Vehicle', 'Bank', 'Retirement', 'Brokerage', 'PersonalProperty', 'LifeInsurance', 'Other']

interface AssetFormState {
  id?: string
  description: string
  category: AssetCategory
  probate: boolean
  paInheritanceTaxable: boolean
  ownershipNote: string
  dodValue: string
  valuationNotes: string
  disposed: boolean
  disposedNote: string
}

const emptyForm: AssetFormState = {
  description: '',
  category: 'RealEstate',
  probate: true,
  paInheritanceTaxable: true,
  ownershipNote: '',
  dodValue: '',
  valuationNotes: '',
  disposed: false,
  disposedNote: ''
}

export const AssetsPage = () => {
  const { assets, addAsset, updateAsset, deleteAsset } = useDataContext()
  const [form, setForm] = useState<AssetFormState>(emptyForm)
  const [filterCategory, setFilterCategory] = useState<'all' | AssetCategory>('all')
  const [filterProbate, setFilterProbate] = useState<'all' | 'probate' | 'non-probate'>('all')

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      const matchesCategory = filterCategory === 'all' || asset.category === filterCategory
      const matchesProbate =
        filterProbate === 'all' ||
        (filterProbate === 'probate' && asset.probate) ||
        (filterProbate === 'non-probate' && !asset.probate)
      return matchesCategory && matchesProbate
    })
  }, [assets, filterCategory, filterProbate])

  const totalValue = useMemo(
    () => filteredAssets.reduce((sum, asset) => sum + (asset.dodValue ?? 0), 0),
    [filteredAssets]
  )

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.description.trim()) return
    const payload: Omit<AssetRecord, 'id' | 'createdAt' | 'updatedAt'> = {
      description: form.description.trim(),
      category: form.category,
      probate: form.probate,
      paInheritanceTaxable: form.paInheritanceTaxable,
      ownershipNote: form.ownershipNote.trim() || undefined,
      dodValue: form.dodValue ? Number(form.dodValue) : undefined,
      valuationNotes: form.valuationNotes.trim() || undefined,
      documents: [],
      disposed: form.disposed,
      disposedNote: form.disposedNote.trim() || undefined
    }
    if (form.id) {
      await updateAsset(form.id, payload)
    } else {
      await addAsset(payload)
    }
    setForm(emptyForm)
  }

  const handleEdit = (asset: AssetRecord) => {
    setForm({
      id: asset.id,
      description: asset.description,
      category: asset.category,
      probate: asset.probate,
      paInheritanceTaxable: asset.paInheritanceTaxable,
      ownershipNote: asset.ownershipNote ?? '',
      dodValue: asset.dodValue ? String(asset.dodValue) : '',
      valuationNotes: asset.valuationNotes ?? '',
      disposed: asset.disposed ?? false,
      disposedNote: asset.disposedNote ?? ''
    })
  }

  const cancelEdit = () => setForm(emptyForm)

  return (
    <div className="space-y-6">
      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="text-lg font-semibold">{form.id ? 'Update asset' : 'Add asset'}</h2>
            <p className="text-sm text-slate-500">Track probate and non-probate property with date-of-death values.</p>
          </div>
        </div>
        <form className="card-body grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <div className="md:col-span-2">
            <label className="label" htmlFor="assetDescription">
              Description
            </label>
            <input
              id="assetDescription"
              className="input"
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Primary residence at 123 Maple St"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="assetCategory">
              Category
            </label>
            <select
              id="assetCategory"
              className="input"
              value={form.category}
              onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value as AssetCategory }))}
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="assetValue">
              Date-of-death value (USD)
            </label>
            <input
              id="assetValue"
              type="number"
              min="0"
              step="0.01"
              className="input"
              value={form.dodValue}
              onChange={(event) => setForm((prev) => ({ ...prev, dodValue: event.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="assetOwnership">
              Ownership notes
            </label>
            <input
              id="assetOwnership"
              className="input"
              value={form.ownershipNote}
              onChange={(event) => setForm((prev) => ({ ...prev, ownershipNote: event.target.value }))}
              placeholder="Joint with right of survivorship"
            />
          </div>
          <div>
            <label className="label" htmlFor="assetNotes">
              Valuation notes
            </label>
            <textarea
              id="assetNotes"
              className="input"
              rows={3}
              value={form.valuationNotes}
              onChange={(event) => setForm((prev) => ({ ...prev, valuationNotes: event.target.value }))}
              placeholder="Appraised by ABC Realty on"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                checked={form.probate}
                onChange={(event) => setForm((prev) => ({ ...prev, probate: event.target.checked }))}
              />
              Probate asset
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                checked={form.paInheritanceTaxable}
                onChange={(event) => setForm((prev) => ({ ...prev, paInheritanceTaxable: event.target.checked }))}
              />
              PA inheritance taxable
            </label>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                checked={form.disposed}
                onChange={(event) => setForm((prev) => ({ ...prev, disposed: event.target.checked }))}
              />
              Mark as disposed
            </label>
            <input
              className="input"
              placeholder="Disposition details"
              value={form.disposedNote}
              onChange={(event) => setForm((prev) => ({ ...prev, disposedNote: event.target.value }))}
            />
          </div>
          <div className="flex items-center gap-3 md:col-span-2">
            <button type="submit" className="btn btn-primary">
              {form.id ? 'Save changes' : 'Add asset'}
            </button>
            {form.id && (
              <button type="button" className="btn btn-secondary" onClick={cancelEdit}>
                Cancel edit
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="card">
        <div className="card-header flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Asset inventory</h2>
            <p className="text-sm text-slate-500">Total estate FMV: ${totalValue.toLocaleString()}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <select className="input" value={filterCategory} onChange={(event) => setFilterCategory(event.target.value as typeof filterCategory)}>
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <select className="input" value={filterProbate} onChange={(event) => setFilterProbate(event.target.value as typeof filterProbate)}>
              <option value="all">All ownership</option>
              <option value="probate">Probate</option>
              <option value="non-probate">Non-probate</option>
            </select>
          </div>
        </div>
        <div className="card-body overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Description</th>
                <th className="px-3 py-2 text-left font-medium">Category</th>
                <th className="px-3 py-2 text-left font-medium">Probate</th>
                <th className="px-3 py-2 text-left font-medium">Taxable</th>
                <th className="px-3 py-2 text-right font-medium">DOD value</th>
                <th className="px-3 py-2 text-left font-medium">Ownership</th>
                <th className="px-3 py-2 text-left font-medium">Disposition</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredAssets.map((asset) => (
                <tr key={asset.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                  <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100">{asset.description}</td>
                  <td className="px-3 py-2 text-slate-500">{asset.category}</td>
                  <td className="px-3 py-2">{asset.probate ? 'Probate' : 'Non-probate'}</td>
                  <td className="px-3 py-2">{asset.paInheritanceTaxable ? 'Taxable' : 'Exempt'}</td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {asset.dodValue ? `$${asset.dodValue.toLocaleString()}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-500">{asset.ownershipNote ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-500">{asset.disposed ? asset.disposedNote || 'Disposed' : 'Holding'}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2 text-xs">
                      <button type="button" className="text-brand-600 hover:underline" onClick={() => handleEdit(asset)}>
                        Edit
                      </button>
                      <button type="button" className="text-rose-500 hover:underline" onClick={() => void deleteAsset(asset.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredAssets.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-sm text-slate-500">
                    No assets match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
