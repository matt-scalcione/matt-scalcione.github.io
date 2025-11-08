import { FormEvent, useState } from 'react'
import dayjs from 'dayjs'
import { useDataContext } from '../context/DataContext'
import { BeneficiaryRecord } from '../types'
import { formatDate, formatDateInput } from '../utils/date'

interface BeneficiaryFormState {
  id?: string
  name: string
  relation: string
  email: string
  phone: string
  address: string
  sharePct: string
  noticeDate: string
  notes: string
}

const emptyForm: BeneficiaryFormState = {
  name: '',
  relation: '',
  email: '',
  phone: '',
  address: '',
  sharePct: '',
  noticeDate: '',
  notes: ''
}

export const BeneficiariesPage = () => {
  const { beneficiaries, addBeneficiary, updateBeneficiary, deleteBeneficiary } = useDataContext()
  const [form, setForm] = useState<BeneficiaryFormState>(emptyForm)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.name.trim()) return
    const payload: Omit<BeneficiaryRecord, 'id' | 'createdAt' | 'updatedAt'> = {
      name: form.name.trim(),
      relation: form.relation.trim(),
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      address: form.address.trim() || undefined,
      sharePct: form.sharePct ? Number(form.sharePct) : undefined,
      rule10_5NoticeSentDate: form.noticeDate ? dayjs(form.noticeDate).toISOString() : undefined,
      notes: form.notes.trim() || undefined
    }
    if (form.id) {
      await updateBeneficiary(form.id, payload)
    } else {
      await addBeneficiary(payload)
    }
    setForm(emptyForm)
  }

  const handleEdit = (beneficiary: BeneficiaryRecord) => {
    setForm({
      id: beneficiary.id,
      name: beneficiary.name,
      relation: beneficiary.relation,
      email: beneficiary.email ?? '',
      phone: beneficiary.phone ?? '',
      address: beneficiary.address ?? '',
      sharePct: beneficiary.sharePct?.toString() ?? '',
      noticeDate: formatDateInput(beneficiary.rule10_5NoticeSentDate ?? ''),
      notes: beneficiary.notes ?? ''
    })
  }

  const cancelEdit = () => setForm(emptyForm)

  return (
    <div className="space-y-6">
      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="text-lg font-semibold">{form.id ? 'Update beneficiary' : 'Add beneficiary'}</h2>
            <p className="text-sm text-slate-500">Maintain contact details and Rule 10.5 notice tracking.</p>
          </div>
        </div>
        <form className="card-body grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <div>
            <label className="label" htmlFor="beneficiaryName">
              Name
            </label>
            <input
              id="beneficiaryName"
              className="input"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="beneficiaryRelation">
              Relation
            </label>
            <input
              id="beneficiaryRelation"
              className="input"
              value={form.relation}
              onChange={(event) => setForm((prev) => ({ ...prev, relation: event.target.value }))}
              placeholder="Daughter"
            />
          </div>
          <div>
            <label className="label" htmlFor="beneficiaryEmail">
              Email
            </label>
            <input
              id="beneficiaryEmail"
              type="email"
              className="input"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="beneficiaryPhone">
              Phone
            </label>
            <input
              id="beneficiaryPhone"
              className="input"
              value={form.phone}
              onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <label className="label" htmlFor="beneficiaryAddress">
              Mailing address
            </label>
            <textarea
              id="beneficiaryAddress"
              className="input"
              rows={2}
              value={form.address}
              onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="beneficiaryShare">
              Share %
            </label>
            <input
              id="beneficiaryShare"
              type="number"
              min="0"
              max="100"
              step="0.01"
              className="input"
              value={form.sharePct}
              onChange={(event) => setForm((prev) => ({ ...prev, sharePct: event.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="beneficiaryNoticeDate">
              Rule 10.5 notice sent
            </label>
            <input
              id="beneficiaryNoticeDate"
              type="date"
              className="input"
              value={form.noticeDate}
              onChange={(event) => setForm((prev) => ({ ...prev, noticeDate: event.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <label className="label" htmlFor="beneficiaryNotes">
              Notes
            </label>
            <textarea
              id="beneficiaryNotes"
              className="input"
              rows={3}
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
            />
          </div>
          <div className="flex items-center gap-3 md:col-span-2">
            <button type="submit" className="btn btn-primary">
              {form.id ? 'Save changes' : 'Add beneficiary'}
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
        <div className="card-header">
          <h2 className="text-lg font-semibold">Heir roster</h2>
        </div>
        <div className="card-body overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Name</th>
                <th className="px-3 py-2 text-left font-medium">Relation</th>
                <th className="px-3 py-2 text-left font-medium">Contact</th>
                <th className="px-3 py-2 text-left font-medium">Address</th>
                <th className="px-3 py-2 text-left font-medium">Share %</th>
                <th className="px-3 py-2 text-left font-medium">Notice mailed</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {beneficiaries.map((beneficiary) => (
                <tr key={beneficiary.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                  <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100">{beneficiary.name}</td>
                  <td className="px-3 py-2 text-slate-500">{beneficiary.relation}</td>
                  <td className="px-3 py-2 text-slate-500">
                    {[beneficiary.email, beneficiary.phone].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-500">{beneficiary.address ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-500">{beneficiary.sharePct ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-500">{formatDate(beneficiary.rule10_5NoticeSentDate ?? '')}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2 text-xs">
                      <button type="button" className="text-brand-600 hover:underline" onClick={() => handleEdit(beneficiary)}>
                        Edit
                      </button>
                      <button type="button" className="text-rose-500 hover:underline" onClick={() => void deleteBeneficiary(beneficiary.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {beneficiaries.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-500">
                    No beneficiaries added yet.
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
