import clsx from 'clsx'
import { TaskStatus } from '../types'

const statusStyles: Record<TaskStatus, string> = {
  Todo: 'badge-muted',
  InProgress: 'badge-warning',
  Blocked: 'badge-danger',
  Done: 'badge-success'
}

const statusLabels: Record<TaskStatus, string> = {
  Todo: 'To do',
  InProgress: 'In progress',
  Blocked: 'Blocked',
  Done: 'Done'
}

export const StatusBadge = ({ status }: { status: TaskStatus }) => {
  return <span className={clsx('badge', statusStyles[status])}>{statusLabels[status]}</span>
}

export const getStatusLabel = (status: TaskStatus) => statusLabels[status]
