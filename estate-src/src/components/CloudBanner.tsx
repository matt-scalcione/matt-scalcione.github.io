import { useAuth } from '../context/AuthContext'

interface CloudBannerProps {
  variant?: 'warning' | 'info'
}

export const CloudBanner = ({ variant = 'warning' }: CloudBannerProps) => {
  const { cloudReady, cloudError, safeMode } = useAuth()

  if (cloudReady || !cloudError) {
    return null
  }

  const isSafeMode = safeMode
  const heading = isSafeMode ? 'Safe mode enabled' : 'Cloud unavailable'
  const description = isSafeMode
    ? 'Supabase features are disabled so you can work locally. Enable cloud to try again.'
    : cloudError

  const borderClass = variant === 'info' ? 'border-slate-200 bg-slate-50 text-slate-700' : 'border-amber-200 bg-amber-50 text-amber-900'

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm ${borderClass}`}>
      <p className="font-semibold">{heading}</p>
      <p className="mt-1 leading-relaxed">{description}</p>
    </div>
  )
}
