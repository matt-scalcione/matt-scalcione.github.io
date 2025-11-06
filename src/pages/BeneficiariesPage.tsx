import { FormEvent, useState } from 'react'
import { FaPlus } from 'react-icons/fa'
import { useDataContext } from '../contexts/DataContext'
import { BeneficiaryRecord } from '../types'
import { formatDate } from '../utils/dates'

interface BeneficiaryFormState {
  id?: string
  name: string
  relation: string
  email: string
  phone: string
  address: string
  share: string
  notes: string
  noticeSentDate: string
}

const emptyForm: BeneficiaryFormState = {
  name: '',
  relation: '',
  email: '',
  phone: '',
  address: '',
  share: '',
  notes: '',
  noticeSentDate: ''
}

export const BeneficiariesPage = () => {
  const {
    data: { beneficiaries },
    addBeneficiary,
    updateBeneficiary,
    removeBeneficiary
  } = useDataContext()

  const [form, setForm] = useState<BeneficiaryFormState>(emptyForm)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!form.name.trim()) return

    const payload: Omit<BeneficiaryRecord, 'id'> = {
      name: form.name,
      relation: form.relation || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      address: form.address || undefined,
      share: form.share || undefined,
      notes: form.notes || undefined,
      noticeSentDate: form.noticeSentDate || undefined
    }

    if (form.id) {
      updateBeneficiary(form.id, payload)
    } else {
      addBeneficiary(payload)
    }
    setForm(emptyForm)
  }

  const handleEdit = (beneficiary: BeneficiaryRecord) => {
    setForm({
      id: beneficiary.id,
      name: beneficiary.name,
      relation: beneficiary.relation ?? '',
      email: beneficiary.email ?? '',
      phone: beneficiary.phone ?? '',
      address: beneficiary.address ?? '',
      share: beneficiary.share ?? '',
      notes: beneficiary.notes ?? '',
      noticeSentDate: beneficiary.noticeSentDate ?? ''
    })
  }

  return (
    <div className="page beneficiaries">
      <section className="card">
        <div className="section-header">
          <h2>{form.id ? 'Update Beneficiary' : 'Add Beneficiary / Heir'}</h2>
        </div>
        <form className="form grid" onSubmit={handleSubmit}>
          <label>
            <span>Name</span>
            <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required />
          </label>
          <label>
            <span>Relationship</span>
            <input value={form.relation} onChange={(event) => setForm((prev) => ({ ...prev, relation: event.target.value }))} placeholder="Daughter, Son, Charity, etc." />
          </label>
          <label>
            <span>Email</span>
            <input type="email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} />
          </label>
          <label>
            <span>Phone</span>
            <input value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} />
          </label>
          <label>
            <span>Mailing address</span>
            <textarea value={form.address} onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))} rows={3} />
          </label>
          <label>
            <span>Share / bequest</span>
            <input value={form.share} onChange={(event) => setForm((prev) => ({ ...prev, share: event.target.value }))} placeholder="50%, specific asset, etc." />
          </label>
          <label>
            <span>Rule 10.5 notice sent</span>
            <input type="date" value={form.noticeSentDate} onChange={(event) => setForm((prev) => ({ ...prev, noticeSentDate: event.target.value }))} />
          </label>
          <label>
            <span>Notes</span>
            <textarea value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} rows={3} />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn primary">
              <FaPlus /> {form.id ? 'Save changes' : 'Add person'}
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
          <h2>Beneficiary Directory</h2>
        </div>
        {beneficiaries.length === 0 ? (
          <p className="empty">Maintain a record of heirs, their contact details, and the date Rule 10.5 notices were sent.</p>
        ) : (
          <div className="card-grid">
            {beneficiaries.map((beneficiary) => (
              <div key={beneficiary.id} className="profile-card">
                <header>
                  <h3>{beneficiary.name}</h3>
                  {beneficiary.relation && <span className="meta-item">{beneficiary.relation}</span>}
                </header>
                <div className="profile-details">
                  {beneficiary.email && <p><strong>Email:</strong> {beneficiary.email}</p>}
                  {beneficiary.phone && <p><strong>Phone:</strong> {beneficiary.phone}</p>}
                  {beneficiary.address && (
                    <p>
                      <strong>Address:</strong>
                      <br />
                      {beneficiary.address}
                    </p>
                  )}
                  {beneficiary.share && <p><strong>Share:</strong> {beneficiary.share}</p>}
                  {beneficiary.noticeSentDate && <p><strong>Notice sent:</strong> {formatDate(beneficiary.noticeSentDate)}</p>}
                  {beneficiary.notes && <p>{beneficiary.notes}</p>}
                </div>
                <div className="profile-actions">
                  <button type="button" className="btn link" onClick={() => handleEdit(beneficiary)}>
                    Edit
                  </button>
                  <button type="button" className="btn link danger" onClick={() => removeBeneficiary(beneficiary.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
