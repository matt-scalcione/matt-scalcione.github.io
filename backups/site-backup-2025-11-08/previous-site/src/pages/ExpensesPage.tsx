import { FormEvent, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { useDataContext } from '../context/DataContext'
import { ExpenseCategory, ExpenseRecord } from '../types'
import { formatDate, formatDateInput } from '../utils/date'
import { exportExpensesToCsv } from '../utils/export'

const categories: ExpenseCategory[] = ['Funeral', 'Utilities', 'Maintenance', 'CourtFees', 'Professional', 'Tax', 'Other']

interface ExpenseFormState {
  id?: string
  date: string
  payee: string
  description: string
  category: ExpenseCategory
  amount: string
  paidFrom: 'Estate' | 'ExecutorAdvance'
  reimbursed: boolean
  notes: string
}

const emptyForm: ExpenseFormState = {
  date: dayjs().format('YYYY-MM-DD'),
  payee: '',
  description: '',
  category: 'Funeral',
  amount: '',
  paidFrom: 'Estate',
  reimbursed: false,
  notes: ''
}

export const ExpensesPage = () => {
  const { expenses, addExpense, updateExpense, deleteExpense } = useDataContext()
  const [form, setForm] = useState<ExpenseFormState>(emptyForm)
  const [filterCategory, setFilterCategory] = useState<'all' | ExpenseCategory>('all')
  const [filterPaidFrom, setFilterPaidFrom] = useState<'all' | 'Estate' | 'ExecutorAdvance'>('all')

  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const matchesCategory = filterCategory === 'all' || expense.category === filterCategory
      const matchesSource = filterPaidFrom === 'all' || expense.paidFrom === filterPaidFrom
      return matchesCategory && matchesSource
    })
  }, [expenses, filterCategory, filterPaidFrom])

  const total = useMemo(() => filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0), [filteredExpenses])
  const unreimbursedTotal = useMemo(
    () => expenses.filter((expense) => expense.paidFrom === 'ExecutorAdvance' && !expense.reimbursed).reduce((sum, e) => sum + e.amount, 0),
    [expenses]
  )

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.payee.trim() || !form.amount) return
    const payload: Omit<ExpenseRecord, 'id' | 'createdAt' | 'updatedAt'> = {
      date: dayjs(form.date).toISOString(),
      payee: form.payee.trim(),
      description: form.description.trim(),
      category: form.category,
      amount: Number(form.amount),
      paidFrom: form.paidFrom,
      reimbursed: form.reimbursed,
      notes: form.notes.trim() || undefined,
      receiptId: undefined
    }
    if (form.id) {
      await updateExpense(form.id, payload)
    } else {
      await addExpense(payload)
    }
    setForm(emptyForm)
  }

  const handleEdit = (expense: ExpenseRecord) => {
    setForm({
      id: expense.id,
      date: formatDateInput(expense.date) || dayjs().format('YYYY-MM-DD'),
      payee: expense.payee,
      description: expense.description,
      category: expense.category,
      amount: expense.amount.toString(),
      paidFrom: expense.paidFrom,
      reimbursed: expense.reimbursed,
      notes: expense.notes ?? ''
    })
  }

  const cancelEdit = () => setForm(emptyForm)

  return (
    <div className="space-y-6">
      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="text-lg font-semibold">{form.id ? 'Update expense' : 'Log expense'}</h2>
            <p className="text-sm text-slate-500">Track reimbursements and estate disbursements.</p>
          </div>
        </div>
        <form className="card-body grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <div>
            <label className="label" htmlFor="expenseDate">
              Date
            </label>
            <input
              id="expenseDate"
              type="date"
              className="input"
              value={form.date}
              onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="expensePayee">
              Payee
            </label>
            <input
              id="expensePayee"
              className="input"
              value={form.payee}
              onChange={(event) => setForm((prev) => ({ ...prev, payee: event.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="expenseDescription">
              Description
            </label>
            <input
              id="expenseDescription"
              className="input"
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Probate filing fee"
            />
          </div>
          <div>
            <label className="label" htmlFor="expenseCategory">
              Category
            </label>
            <select
              id="expenseCategory"
              className="input"
              value={form.category}
              onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value as ExpenseCategory }))}
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="expenseAmount">
              Amount (USD)
            </label>
            <input
              id="expenseAmount"
              type="number"
              min="0"
              step="0.01"
              className="input"
              value={form.amount}
              onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="expensePaidFrom">
              Paid from
            </label>
            <select
              id="expensePaidFrom"
              className="input"
              value={form.paidFrom}
              onChange={(event) => setForm((prev) => ({ ...prev, paidFrom: event.target.value as 'Estate' | 'ExecutorAdvance' }))}
            >
              <option value="Estate">Estate funds</option>
              <option value="ExecutorAdvance">Advanced by executor</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                checked={form.reimbursed}
                onChange={(event) => setForm((prev) => ({ ...prev, reimbursed: event.target.checked }))}
              />
              Reimbursed
            </label>
          </div>
          <div className="md:col-span-2">
            <label className="label" htmlFor="expenseNotes">
              Notes
            </label>
            <textarea
              id="expenseNotes"
              className="input"
              rows={3}
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              placeholder="Receipt filed in documents"
            />
          </div>
          <div className="flex items-center gap-3 md:col-span-2">
            <button type="submit" className="btn btn-primary">
              {form.id ? 'Save changes' : 'Add expense'}
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
        <div className="card-header flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Expense ledger</h2>
            <p className="text-sm text-slate-500">Unreimbursed executor advances: ${unreimbursedTotal.toFixed(2)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select className="input" value={filterCategory} onChange={(event) => setFilterCategory(event.target.value as typeof filterCategory)}>
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <select className="input" value={filterPaidFrom} onChange={(event) => setFilterPaidFrom(event.target.value as typeof filterPaidFrom)}>
              <option value="all">All sources</option>
              <option value="Estate">Estate</option>
              <option value="ExecutorAdvance">Executor advance</option>
            </select>
            <button type="button" className="btn btn-secondary" onClick={() => exportExpensesToCsv(filteredExpenses)}>
              Export CSV
            </button>
          </div>
        </div>
        <div className="card-body overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Date</th>
                <th className="px-3 py-2 text-left font-medium">Payee</th>
                <th className="px-3 py-2 text-left font-medium">Description</th>
                <th className="px-3 py-2 text-left font-medium">Category</th>
                <th className="px-3 py-2 text-left font-medium">Paid from</th>
                <th className="px-3 py-2 text-left font-medium">Reimbursed</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredExpenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                  <td className="px-3 py-2 text-slate-500">{formatDate(expense.date)}</td>
                  <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100">{expense.payee}</td>
                  <td className="px-3 py-2 text-slate-500">{expense.description}</td>
                  <td className="px-3 py-2 text-slate-500">{expense.category}</td>
                  <td className="px-3 py-2 text-slate-500">{expense.paidFrom === 'Estate' ? 'Estate' : 'Executor advance'}</td>
                  <td className="px-3 py-2 text-slate-500">{expense.reimbursed ? 'Yes' : 'No'}</td>
                  <td className="px-3 py-2 text-right font-semibold">${expense.amount.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2 text-xs">
                      <button type="button" className="text-brand-600 hover:underline" onClick={() => handleEdit(expense)}>
                        Edit
                      </button>
                      <button type="button" className="text-rose-500 hover:underline" onClick={() => void deleteExpense(expense.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-sm text-slate-500">
                    No expenses match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={6} className="px-3 py-2 text-right text-sm font-semibold">
                  Total
                </td>
                <td className="px-3 py-2 text-right text-sm font-semibold">${total.toFixed(2)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  )
}
