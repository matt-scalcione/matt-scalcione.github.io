import { jsPDF } from 'jspdf'
import { ExpenseRecord, Task } from '../types'

export const downloadFile = (content: string, filename: string, type = 'text/csv') => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

export const exportTasksToCsv = (tasks: Task[]) => {
  const header = ['Title', 'Description', 'Status', 'Due Date', 'Category', 'Tags']
  const rows = tasks.map((task) => [
    sanitizeCsv(task.title),
    sanitizeCsv(task.description ?? ''),
    sanitizeCsv(task.status),
    sanitizeCsv(task.dueDate ?? ''),
    sanitizeCsv(task.category ?? ''),
    sanitizeCsv(task.tags.join('; '))
  ])
  const csvContent = [header, ...rows].map((row) => row.join(',')).join('\n')
  downloadFile(csvContent, 'estate-tasks.csv')
}

export const exportTasksToPdf = (tasks: Task[]) => {
  const doc = new jsPDF({ orientation: 'landscape' })
  doc.setFontSize(14)
  doc.text('Estate Task Checklist', 14, 16)
  doc.setFontSize(10)
  const colWidth = [40, 70, 20, 30, 30, 40]
  let y = 24
  const headers = ['Title', 'Description', 'Status', 'Due', 'Category', 'Tags']
  headers.forEach((header, idx) => {
    doc.text(header, 14 + colWidth.slice(0, idx).reduce((a, b) => a + b, 0), y)
  })
  y += 6
  tasks.forEach((task) => {
    const values = [
      task.title,
      task.description ?? '',
      statusLabel(task.status),
      task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '',
      task.category ?? '',
      task.tags.join(', ')
    ]
    values.forEach((value, idx) => {
      doc.text(doc.splitTextToSize(value, colWidth[idx] - 4), 14 + colWidth.slice(0, idx).reduce((a, b) => a + b, 0), y)
    })
    y += 8
    if (y > 190) {
      doc.addPage()
      y = 16
    }
  })
  doc.save('estate-tasks.pdf')
}

export const exportExpensesToCsv = (expenses: ExpenseRecord[]) => {
  const header = ['Date', 'Payee', 'Description', 'Amount', 'Category', 'Paid From Estate', 'Reimbursed']
  const rows = expenses.map((expense) => [
    sanitizeCsv(expense.date),
    sanitizeCsv(expense.payee),
    sanitizeCsv(expense.description),
    expense.amount.toString(),
    sanitizeCsv(expense.category),
    expense.paidFromEstate ? 'Yes' : 'No',
    expense.reimbursed ? 'Yes' : 'No'
  ])
  const csvContent = [header, ...rows].map((row) => row.join(',')).join('\n')
  downloadFile(csvContent, 'estate-expenses.csv')
}

const statusLabel = (status: Task['status']) => {
  switch (status) {
    case 'todo':
      return 'To Do'
    case 'inProgress':
      return 'In Progress'
    case 'completed':
      return 'Completed'
    default:
      return status
  }
}

const sanitizeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`
