import { ReactNode } from 'react'

interface SummaryCardProps {
  title: string
  value: ReactNode
  description?: string
  accent?: 'blue' | 'green' | 'orange' | 'purple' | 'red'
}

export const SummaryCard = ({ title, value, description, accent = 'blue' }: SummaryCardProps) => (
  <div className={`summary-card accent-${accent}`}>
    <h3>{title}</h3>
    <div className="summary-value">{value}</div>
    {description && <p className="summary-description">{description}</p>}
  </div>
)
