import dayjs from 'dayjs'
import { calculateDeadlines } from './dates'
import { EstateInfo, Task } from '../types'

export const applyAutomaticDueDates = (tasks: Task[], info: EstateInfo): Task[] => {
  const deadlines = calculateDeadlines(info)
  return tasks.map((task) => {
    if (task.autoSchedule) {
      const dueDate = deadlines[task.autoSchedule]
      return {
        ...task,
        dueDate
      }
    }
    return task
  })
}

export const getTaskProgress = (tasks: Task[]) => {
  const total = tasks.length
  const completed = tasks.filter((task) => task.status === 'completed').length
  return { total, completed, percentage: total === 0 ? 0 : Math.round((completed / total) * 100) }
}

export const sortTasksByDueDate = (tasks: Task[]) =>
  [...tasks].sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0
    if (!a.dueDate) return 1
    if (!b.dueDate) return -1
    return dayjs(a.dueDate).unix() - dayjs(b.dueDate).unix()
  })
