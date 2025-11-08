import { TaskStatus } from '../types'

const labels: Record<TaskStatus, string> = {
  todo: 'To Do',
  inProgress: 'In Progress',
  completed: 'Completed'
}

export const StatusBadge = ({ status }: { status: TaskStatus }) => (
  <span className={`status-badge status-${status}`}>{labels[status]}</span>
)
