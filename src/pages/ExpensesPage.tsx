import { FormEvent, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { FaDownload, FaPlus } from 'react-icons/fa'
import { useDataContext } from '../contexts/DataContext'
import { exportExpensesToCsv } from '../utils/exporters'
import { ExpenseRecord } from '../types'
import { formatDate } from '../utils/dates'

interface ExpenseFormState {
  id?: string
  date: string
  payee: string
  description: string
  amount: string
  category: string
  paidFromEstate: 'yes' | 'no'
  reimbursed: 'yes' | 'no'
  reimbursementDate: string
  notes: string
  receiptId: string
}

const categories = [
  'Funeral Expense',
  'Utility Bill',
  'Maintenance',
  'Legal Fee',
  'Probate Fee',
  'Insurance',
  'Tax Payment',
  'Miscellaneous'
]

const emptyForm: ExpenseFormState = {
  date: dayjs().format('YYYY-MM-DD'),
  payee: '',
  description: '',
  amount: '',
  category: '',
  paidFromEstate: 'yes',
  reimbursed: 'no',
  reimbursementDate: '',
  notes: '',
  receiptId: ''
}

export const ExpensesPage = () => {
  const {
    data: { expenses, documents },
    addExpense,
    updateExpense,
    removeExpense
  } = useDataContext()

  const [form, setForm] = useState<ExpenseFormState>(emptyForm)
  const [filter, setFilter] = useState<'all' | 'estate' | 'executor' | 'unreimbursed'>('all')

  const filteredExpenses = useMemo(() => {
    switch (filter) {
      case 'estate':
        return expenses.filter((expense) => expense.paidFromEstate)
      case 'executor':
        return expenses.filter((expense) => !expense.paidFromEstate)
      case 'unreimbursed':
        return expenses.filter((expense) => !expense.paidFromEstate && !expense.reimbursed)
      default:
        return expenses
    }
  }, [expenses, filter])

  const estateTotal = expenses.filter((expense) => expense.paidFromEstate).reduce((sum, expense) => sum + expense.amount, 0)
  const advancesTotal = expenses.filter((expense) => !expense.paidFromEstate).reduce((sum, expense) => sum + expense.amount, 0)
  const unreimbursedTotal = expenses
    .filter((expense) => !expense.paidFromEstate && !expense.reimbursed)
    .reduce((sum, expense) => sum + expense.amount, 0)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!form.payee.trim() || !form.amount) return

    const payload: Omit<ExpenseRecord, 'id'> = {
      date: form.date,
      payee: form.payee,
      description: form.description,
      amount: Number(form.amount),
      category: form.category || 'Miscellaneous',
      paidFromEstate: form.paidFromEstate === 'yes',
      reimbursed: form.reimbursed === 'yes',
      reimbursementDate: form.reimbursementDate || undefined,
      notes: form.notes || undefined,
      receiptId: form.receiptId || undefined
    }

    if (form.id) {
      updateExpense(form.id, payload)
    } else {
      addExpense(payload)
    }
    setForm(emptyForm)
  }

  const handleEdit = (expense: ExpenseRecord) => {
    setForm({
      id: expense.id,
      date: dayjs(expense.date).format('YYYY-MM-DD'),
      payee: expense.payee,
      description: expense.description,
      amount: expense.amount.toString(),
      category: expense.category,
      paidFromEstate: expense.paidFromEstate ? 'yes' : 'no',
      reimbursed: expense.reimbursed ? 'yes' : 'no',
      reimbursementDate: expense.reimbursementDate ? dayjs(expense.reimbursementDate).format('YYYY-MM-DD') : '',
      notes: expense.notes ?? '',
      receiptId: expense.receiptId ?? ''
    })
  }

  return (
    <div className="page expenses">
      <section className="card">
        <div className="section-header">
          <h2>{form.id ? 'Update Expense' : 'Log Estate Expense'}</h2>
        </div>
        <form className="form grid" onSubmit={handleSubmit}>
          <label>
            <span>Date</span>
            <input type="date" value={form.date} onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))} required />
          </label>
          <label>
            <span>Payee / vendor</span>
            <input value={form.payee} onChange={(event) => setForm((prev) => ({ ...prev, payee: event.target.value }))} required />
          </label>
          <label>
            <span>Description</span>
            <textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} rows={3} />
          </label>
          <label>
            <span>Amount</span>
            <input type="number" min="0" step="0.01" value={form.amount} onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))} required />
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
            <span>Paid from estate account?</span>
            <select value={form.paidFromEstate} onChange={(event) => setForm((prev) => ({ ...prev, paidFromEstate: event.target.value as ExpenseFormState['paidFromEstate'] }))}>
              <option value="yes">Yes</option>
              <option value="no">No (advanced by executor)</option>
            </select>
          </label>
          <label>
            <span>Reimbursed?</span>
            <select value={form.reimbursed} onChange={(event) => setForm((prev) => ({ ...prev, reimbursed: event.target.value as ExpenseFormState['reimbursed'] }))}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </label>
          {form.reimbursed === 'yes' && (
            <label>
              <span>Reimbursement date</span>
              <input type="date" value={form.reimbursementDate} onChange={(event) => setForm((prev) => ({ ...prev, reimbursementDate: event.target.value }))} />
            </label>
          )}
          <label>
            <span>Receipt</span>
            <select value={form.receiptId} onChange={(event) => setForm((prev) => ({ ...prev, receiptId: event.target.value }))}>
              <option value="">No attachment</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Notes</span>
            <textarea value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} rows={3} />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn primary">
              <FaPlus /> {form.id ? 'Save changes' : 'Log expense'}
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
          <h2>Expense Register</h2>
          <div className="actions">
            <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
              <option value="all">All expenses</option>
              <option value="estate">Paid from estate</option>
              <option value="executor">Executor advances</option>
              <option value="unreimbursed">Unreimbursed advances</option>
            </select>
            <button type="button" className="btn" onClick={() => exportExpensesToCsv(expenses)}>
              <FaDownload /> Export CSV
            </button>
          </div>
        </div>
        <div className="inventory-totals">
          <span>Estate account disbursements: ${estateTotal.toFixed(2)}</span>
          <span>Executor advances: ${advancesTotal.toFixed(2)}</span>
          <span>Outstanding reimbursement: ${unreimbursedTotal.toFixed(2)}</span>
        </div>
        {filteredExpenses.length === 0 ? (
          <p className="empty">Track every bill, fee, and reimbursement to support the final accounting and inheritance tax return.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Payee</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Category</th>
                <th>Paid from estate</th>
                <th>Reimbursed</th>
                <th>Receipt</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses
                .slice()
                .sort((a, b) => dayjs(b.date).unix() - dayjs(a.date).unix())
                .map((expense) => (
                  <tr key={expense.id}>
                    <td>{formatDate(expense.date)}</td>
                    <td>{expense.payee}</td>
                    <td>
                      {expense.description}
                      {expense.notes && <p className="meta-item">{expense.notes}</p>}
                    </td>
                    <td>${expense.amount.toFixed(2)}</td>
                    <td>{expense.category}</td>
                    <td>{expense.paidFromEstate ? 'Yes' : 'No'}</td>
                    <td>
                      {expense.reimbursed ? (
                        <span className="meta-item">Yes {expense.reimbursementDate && `(${formatDate(expense.reimbursementDate)})`}</span>
                      ) : (
                        'No'
                      )}
                    </td>
                    <td>
                      {expense.receiptId ? (
                        (() => {
                          const doc = documents.find((document) => document.id === expense.receiptId)
                          return doc ? (
                            <a href={doc.dataUrl} download={doc.fileName} className="text-link">
                              {doc.title}
                            </a>
                          ) : (
                            <span>Missing</span>
                          )
                        })()
                      ) : (
                        <span>None</span>
                      )}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button type="button" className="btn link" onClick={() => handleEdit(expense)}>
                          Edit
                        </button>
                        <button type="button" className="btn link danger" onClick={() => removeExpense(expense.id)}>
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
