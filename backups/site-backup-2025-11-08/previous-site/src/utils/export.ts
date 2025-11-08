import Papa from 'papaparse'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Task, ExpenseRecord } from '../types'
import { formatDate } from './date'

export const downloadFile = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export const exportTasksToCsv = (tasks: Task[]) => {
  const rows = tasks.map((task) => ({
    Title: task.title,
    Description: task.description ?? '',
    Category: task.category,
    Status: task.status,
    Tags: task.tags.join(', '),
    'Due Date': formatDate(task.dueDate, ''),
    'Assigned To': (task.assignedTo ?? []).join(', '),
    'Created At': formatDate(task.createdAt),
    'Updated At': formatDate(task.updatedAt)
  }))
  const csv = Papa.unparse(rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  downloadFile(blob, 'estate-tasks.csv')
}

export const exportTasksToPdf = (tasks: Task[]) => {
  const doc = new jsPDF({ orientation: 'landscape' })
  doc.setFontSize(14)
  doc.text('Estate Task Summary', 14, 20)
  const tableData = tasks.map((task) => [
    task.title,
    task.category,
    task.status,
    formatDate(task.dueDate, '—'),
    task.tags.join(', ')
  ])
  autoTable(doc, {
    head: [['Title', 'Category', 'Status', 'Due Date', 'Tags']],
    body: tableData,
    startY: 28,
    styles: { fontSize: 10, cellPadding: 2 },
    headStyles: { fillColor: [99, 102, 241] }
  })
  doc.save('estate-tasks.pdf')
}

export const exportExpensesToCsv = (expenses: ExpenseRecord[]) => {
  const rows = expenses.map((expense) => ({
    Date: expense.date,
    Payee: expense.payee,
    Description: expense.description,
    Category: expense.category,
    Amount: expense.amount.toFixed(2),
    'Paid From': expense.paidFrom,
    Reimbursed: expense.reimbursed ? 'Yes' : 'No'
  }))
  const csv = Papa.unparse(rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  downloadFile(blob, 'estate-expenses.csv')
}
