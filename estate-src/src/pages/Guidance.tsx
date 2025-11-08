import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEstate } from '../context/EstateContext'
import { ESTATE_PLAN_UPDATED_EVENT, loadSeedGuidance } from '../storage/estatePlan'
import {
  NormalizedGuidanceEntry,
  guidanceAnchorForId,
  normalizeGuidanceEntries,
} from '../utils/guidance'

const storageEventMatchesGuidance = (event: StorageEvent, estateId: string) => {
  if (!event.key) return true
  if (event.key === 'seedVersion') return true
  return event.key === `guidance:${estateId}`
}

const Guidance = () => {
  const { activeEstateId, estateProfiles } = useEstate()
  const [entries, setEntries] = useState<NormalizedGuidanceEntry[]>([])
  const [copyFeedback, setCopyFeedback] = useState<{ key: string; status: 'success' | 'error'; message: string } | null>(
    null,
  )
  const feedbackTimer = useRef<number | null>(null)

  const profile = estateProfiles[activeEstateId]

  const refreshGuidance = useCallback(() => {
    const raw = loadSeedGuidance(activeEstateId)
    setEntries(normalizeGuidanceEntries(raw))
  }, [activeEstateId])

  useEffect(() => {
    refreshGuidance()

    const handleStorage = (event: StorageEvent) => {
      if (storageEventMatchesGuidance(event, activeEstateId)) {
        refreshGuidance()
      }
    }

    const handlePlanUpdated = () => {
      refreshGuidance()
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener(ESTATE_PLAN_UPDATED_EVENT, handlePlanUpdated)

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener(ESTATE_PLAN_UPDATED_EVENT, handlePlanUpdated)
    }
  }, [activeEstateId, refreshGuidance])

  useEffect(() => {
    return () => {
      if (feedbackTimer.current) {
        window.clearTimeout(feedbackTimer.current)
      }
    }
  }, [])

  const showFeedback = useCallback((payload: { key: string; status: 'success' | 'error'; message: string }) => {
    if (feedbackTimer.current) {
      window.clearTimeout(feedbackTimer.current)
    }
    setCopyFeedback(payload)
    feedbackTimer.current = window.setTimeout(() => {
      setCopyFeedback(null)
      feedbackTimer.current = null
    }, payload.status === 'success' ? 1800 : 2600)
  }, [])

  const copyText = useCallback(
    async (key: string, text: string) => {
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(text)
        } else {
          const textarea = document.createElement('textarea')
          textarea.value = text
          textarea.setAttribute('readonly', '')
          textarea.style.position = 'absolute'
          textarea.style.left = '-9999px'
          document.body.appendChild(textarea)
          textarea.select()
          const success = document.execCommand('copy')
          document.body.removeChild(textarea)
          if (!success) {
            throw new Error('Copy command failed')
          }
        }
        showFeedback({ key, status: 'success', message: 'Copied to clipboard' })
      } catch (error) {
        console.error(error)
        showFeedback({ key, status: 'error', message: 'Unable to copy text' })
      }
    },
    [showFeedback],
  )

  const guidanceEntries = useMemo(() => {
    return entries.map((entry) => ({ ...entry, anchor: entry.anchor || guidanceAnchorForId(entry.id) }))
  }, [entries])

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary-600">Guidance</p>
        <h1 className="text-3xl font-semibold text-slate-900">Plan guidance &amp; templates</h1>
        <p className="text-sm text-slate-500">
          Step-by-step instructions, filing checklists, and ready-to-send templates tailored to the{' '}
          <span className="font-medium text-slate-700">{profile.label}</span> estate plan.
        </p>
      </header>

      {guidanceEntries.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
          Import an estate plan profile to load guidance pages, deadlines, and templates for this estate.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {guidanceEntries.map((entry) => {
            const feedback = copyFeedback && copyFeedback.key === entry.id ? copyFeedback : null

            return (
              <article key={entry.id} id={entry.anchor} className="card-surface flex flex-col gap-4 md:gap-5">
                <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <h2 className="text-2xl font-semibold text-slate-900">{entry.title}</h2>
                    {entry.summary ? <p className="text-sm text-slate-500">{entry.summary}</p> : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => copyText(entry.id, entry.copyText)}
                    className="inline-flex items-center justify-center rounded-full border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-700 shadow-sm transition hover:border-primary-300 hover:bg-primary-100"
                  >
                    Copy Text
                  </button>
                </header>

                {feedback ? (
                  <p
                    role="status"
                    className={`text-xs font-medium ${
                      feedback.status === 'success' ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {feedback.message}
                  </p>
                ) : null}

                {entry.body ? (
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 shadow-inner">
                    <p className="whitespace-pre-wrap leading-relaxed">{entry.body}</p>
                  </div>
                ) : null}

                {entry.steps.length > 0 ? (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Steps</h3>
                    <ol className="space-y-3 text-sm text-slate-600">
                      {entry.steps.map((step, index) => (
                        <li key={`${entry.id}-step-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                          <div className="flex items-start gap-3">
                            <span className="mt-1 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
                              {index + 1}
                            </span>
                            <div className="space-y-1">
                              {step.title ? <p className="font-medium text-slate-900">{step.title}</p> : null}
                              {step.detail ? (
                                <p className="text-sm text-slate-600">{step.detail}</p>
                              ) : null}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}

                {entry.notes.length > 0 ? (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Notes</h3>
                    <ul className="space-y-2 text-sm text-slate-600">
                      {entry.notes.map((note, index) => (
                        <li key={`${entry.id}-note-${index}`} className="rounded-2xl bg-amber-50/70 p-3">
                          {note}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {entry.templates.length > 0 ? (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Prefilled templates</h3>
                    <ul className="space-y-3">
                      {entry.templates.map((template) => {
                        const templateKey = `${entry.id}-${template.id}`
                        const templateFeedback = copyFeedback && copyFeedback.key === templateKey ? copyFeedback : null

                        return (
                          <li key={template.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="space-y-2">
                                <p className="font-medium text-slate-900">{template.title}</p>
                                <p className="whitespace-pre-wrap text-sm text-slate-600">{template.body}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => copyText(templateKey, template.body)}
                                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700"
                              >
                                Copy template
                              </button>
                            </div>
                            {templateFeedback ? (
                              <p
                                role="status"
                                className={`mt-2 text-xs font-medium ${
                                  templateFeedback.status === 'success' ? 'text-emerald-600' : 'text-rose-600'
                                }`}
                              >
                                {templateFeedback.message}
                              </p>
                            ) : null}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ) : null}

                {entry.links.length > 0 ? (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Resources</h3>
                    <ul className="space-y-2">
                      {entry.links.map((link) => (
                        <li key={link.id}>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-primary-700 shadow-sm transition hover:border-primary-300 hover:bg-primary-50"
                          >
                            <span className="flex flex-col gap-1">
                              <span>{link.label}</span>
                              {link.description ? (
                                <span className="text-xs font-normal text-slate-500">{link.description}</span>
                              ) : null}
                            </span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default Guidance

