import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../storage/tasksDB'
import { useEstate } from '../context/EstateContext'
import { useAuth } from '../context/AuthContext'
import { CloudBanner } from '../components/CloudBanner'
import {
  ESTATE_IDS,
  loadSeedVersion,
  notifyPlanUpdated,
  reseedFromPlan,
  saveEstateProfiles,
  saveSeedVersion,
} from '../storage/estatePlan'
import { EstateSetup, loadEstateSetup, saveEstateSetup } from '../storage/setup'
import { computeDeadlines, formatDeadlineDate, isSetupComplete } from '../utils/deadlines'
import { exportWorkspaceData, importWorkspaceData, type WorkspaceExportPayload } from '../storage/dataTransfer'
import { resetDemoData } from '../storage/demoData'
import { coercePlan, PlanV2 } from '../features/plan/planSchema'
import { clearSupabaseOverrides, getSupabaseOverrides, saveSupabaseOverrides } from '../lib/supabaseClient'
import { disableCloud, enableCloud } from '../lib/safeMode'
import {
  createTask as createTaskCloud,
  importPlanToCloud,
  migrateLocalWorkspaceToCloud,
  migrateLocalDocumentsToCloud,
  syncWorkspaceFromCloud,
  isCloudFallbackError,
  type CloudFallbackError,
} from '../data/cloud'

interface SetupFormState {
  dateOfDeath: string
  lettersGranted: string
  firstPublication: string
  estate1041Required: boolean
}

const toEstateSetup = (state: SetupFormState): EstateSetup => ({
  dateOfDeath: state.dateOfDeath,
  lettersGranted: state.lettersGranted,
  firstPublication: state.firstPublication ? state.firstPublication : null,
  estate1041Required: state.estate1041Required,
})

const defaultFormState: SetupFormState = {
  dateOfDeath: '',
  lettersGranted: '',
  firstPublication: '',
  estate1041Required: true,
}

const SAMPLE_PLAN = JSON.stringify(
  {
    seedVersion: 'v2',
    profiles: [
      {
        id: 'mother',
        label: 'Mother Estate',
        county: 'Wake',
        decedentName: 'Jane Doe',
        dodISO: '2024-01-01',
        lettersISO: null,
        firstPublicationISO: null,
      },
    ],
    seedTasks: [
      {
        estateId: 'mother',
        title: 'Notify heirs',
        description: 'Contact heirs within 30 days.',
        tags: ['communication'],
        dueISO: null,
        status: 'not-started',
        priority: 'med',
      },
    ],
    guidance: [
      {
        estateId: 'mother',
        title: 'Get started',
        body: 'Review the will and notify key contacts.',
        links: [
          {
            label: 'Clerk of Court',
            url: 'https://www.nccourts.gov/',
          },
        ],
      },
    ],
  },
  null,
  2,
)

const formatPlanDate = (iso?: string) => {
  if (!iso) return 'Not set'
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.valueOf())) return iso
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback

const enhanceFallbackMessage = (message: string) =>
  message.includes('Saved locally')
    ? message
    : `${message}. Saved locally; will sync once cloud access is restored.`

const resolveCloudFallbackMessage = (error: CloudFallbackError, fallback: string) =>
  enhanceFallbackMessage(getErrorMessage(error, fallback))

const Profile = () => {
  const navigate = useNavigate()
  const [formState, setFormState] = useState<SetupFormState>(defaultFormState)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateMessage, setGenerateMessage] = useState<string | null>(null)
  const [dataStatusMessage, setDataStatusMessage] = useState<string | null>(null)
  const [dataErrorMessage, setDataErrorMessage] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const { activeEstateId, estateProfiles, setActiveEstateId, refreshEstateProfiles } = useEstate()
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false)
  const [planInput, setPlanInput] = useState('')
  const [planImportError, setPlanImportError] = useState<string | null>(null)
  const [isPlanImporting, setIsPlanImporting] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [seedVersion, setSeedVersion] = useState<string | null>(() => loadSeedVersion())
  const {
    mode: authMode,
    userEmail,
    refreshCloudStatus,
    logout,
    isAuthenticated,
    cloudReady,
    cloudError: cloudValidationError,
    safeMode,
  } = useAuth()
  const [cloudUrl, setCloudUrl] = useState('')
  const [cloudAnonKey, setCloudAnonKey] = useState('')
  const [cloudFeedback, setCloudFeedback] = useState<string | null>(null)
  const [cloudFeedbackError, setCloudFeedbackError] = useState<string | null>(null)
  const [isCloudSaving, setIsCloudSaving] = useState(false)
  const [isCloudSigningOut, setIsCloudSigningOut] = useState(false)
  const [isMigratingData, setIsMigratingData] = useState(false)
  const [dataMigrationStatus, setDataMigrationStatus] = useState<string | null>(null)
  const [dataMigrationError, setDataMigrationError] = useState<string | null>(null)
  const [isMigratingDocs, setIsMigratingDocs] = useState(false)
  const [migrationStatus, setMigrationStatus] = useState<string | null>(null)
  const [migrationError, setMigrationError] = useState<string | null>(null)

  const hydrateSetup = useCallback(() => {
    const stored = loadEstateSetup()
    if (stored) {
      setFormState({
        dateOfDeath: stored.dateOfDeath,
        lettersGranted: stored.lettersGranted,
        firstPublication: stored.firstPublication || '',
        estate1041Required: stored.estate1041Required,
      })
    } else {
      setFormState(defaultFormState)
    }
  }, [])

  useEffect(() => {
    hydrateSetup()
  }, [hydrateSetup])

  useEffect(() => {
    if (!toastMessage) return undefined
    if (typeof window === 'undefined') return undefined
    const timeout = window.setTimeout(() => setToastMessage(null), 3500)
    return () => window.clearTimeout(timeout)
  }, [toastMessage])

  useEffect(() => {
    const overrides = getSupabaseOverrides()
    setCloudUrl(overrides.url)
    setCloudAnonKey(overrides.anonKey)
  }, [])

  useEffect(() => {
    if (authMode !== 'supabase' || !isAuthenticated) return
    void (async () => {
      try {
        await syncWorkspaceFromCloud(activeEstateId)
        refreshEstateProfiles()
        setSeedVersion(loadSeedVersion())
      } catch (error) {
        console.error(error)
      }
    })()
  }, [activeEstateId, authMode, isAuthenticated, refreshEstateProfiles])

  const setup = useMemo(() => {
    const candidate = toEstateSetup(formState)
    return isSetupComplete(candidate) ? candidate : null
  }, [formState])

  const deadlines = useMemo(() => {
    if (!setup) return []
    return computeDeadlines(setup)
  }, [setup])

  const cloudValidationMessage = cloudReady
    ? `✅ Cloud connection ready${userEmail ? ` · ${userEmail}` : ''}`
    : `❌ ${cloudValidationError ?? 'Cloud not configured'}`

  const handleFormChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, type } = event.target
    const value = type === 'checkbox' ? event.target.checked : event.target.value
    setFormState((prev) => ({
      ...prev,
      [name]: value,
    }))
    setStatusMessage(null)
    setErrorMessage(null)
    setGenerateMessage(null)
    setDataStatusMessage(null)
    setDataErrorMessage(null)
  }

  const handleCloudUrlChange = (event: ChangeEvent<HTMLInputElement>) => {
    setCloudUrl(event.target.value)
    setCloudFeedback(null)
    setCloudFeedbackError(null)
  }

  const handleCloudAnonKeyChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setCloudAnonKey(event.target.value)
    setCloudFeedback(null)
    setCloudFeedbackError(null)
  }

  const handleMigrateWorkspace = () => {
    setDataMigrationStatus(null)
    setDataMigrationError(null)

    if (authMode !== 'supabase' || !isAuthenticated) {
      setDataMigrationError('Sign in with Supabase to migrate data.')
      return
    }

    setIsMigratingData(true)

    void (async () => {
      try {
        await migrateLocalWorkspaceToCloud()
        refreshEstateProfiles()
        setDataMigrationStatus('Local estates, guidance, tasks, and journal entries migrated to Supabase.')
      } catch (error) {
        console.error(error)
        const message = getErrorMessage(error, 'Unable to migrate workspace data')
        setDataMigrationError(message)
      } finally {
        setIsMigratingData(false)
      }
    })()
  }

  const handleMigrateDocuments = () => {
    setMigrationStatus(null)
    setMigrationError(null)

    if (authMode !== 'supabase' || !isAuthenticated) {
      setMigrationError('Sign in with Supabase to migrate documents.')
      return
    }

    setIsMigratingDocs(true)

    void (async () => {
      try {
        await migrateLocalDocumentsToCloud()
        setMigrationStatus('Local documents migrated to Supabase Storage.')
      } catch (error) {
        console.error(error)
        const message = getErrorMessage(error, 'Unable to migrate documents')
        setMigrationError(message)
      } finally {
        setIsMigratingDocs(false)
      }
    })()
  }

  const handleCloudSave = () => {
    setCloudFeedback(null)
    setCloudFeedbackError(null)
    setIsCloudSaving(true)

    try {
      saveSupabaseOverrides(cloudUrl, cloudAnonKey)
      refreshCloudStatus()
      setCloudFeedback('Saved Supabase connection settings.')
    } catch (error) {
      console.error(error)
      setCloudFeedbackError('Unable to save Supabase settings. Check your browser storage permissions.')
    } finally {
      setIsCloudSaving(false)
    }
  }

  const handleCloudSignIn = () => {
    setCloudFeedback(null)
    setCloudFeedbackError(null)
    navigate('/login')
  }

  const handleCloudSignOut = async () => {
    setCloudFeedback(null)
    setCloudFeedbackError(null)
    setIsCloudSigningOut(true)

    try {
      await logout()
      setCloudFeedback('Signed out successfully.')
    } catch (error) {
      console.error(error)
      setCloudFeedbackError('Unable to sign out. Try again.')
    } finally {
      setIsCloudSigningOut(false)
    }
  }

  const reloadApp = () => {
    if (typeof window === 'undefined') return
    window.location.reload()
  }

  const handleDisableCloudSafeMode = () => {
    disableCloud()
    reloadApp()
  }

  const handleEnableCloudMode = () => {
    enableCloud()
    reloadApp()
  }

  const handleClearCloudKeys = () => {
    clearSupabaseOverrides()
    reloadApp()
  }

  const persistSetup = (payload: EstateSetup) => {
    saveEstateSetup(payload)
    setStatusMessage('Saved estate profile settings.')
    setErrorMessage(null)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!formState.dateOfDeath || !formState.lettersGranted) {
      setErrorMessage('Date of death and letters granted date are required.')
      return
    }
    setIsSaving(true)
    try {
      persistSetup(toEstateSetup(formState))
    } finally {
      setIsSaving(false)
    }
  }

  const handleGenerateChecklist = async () => {
    setGenerateMessage(null)
    if (!formState.dateOfDeath || !formState.lettersGranted) {
      setErrorMessage('Provide required dates before generating the checklist.')
      return
    }

    const payload = toEstateSetup(formState)
    persistSetup(payload)

    const computed = computeDeadlines(payload).filter((deadline) => deadline.dueDate)

    if (computed.length === 0) {
      setGenerateMessage('Nothing to create yet—add more dates above.')
      return
    }

    setIsGenerating(true)
    try {
      const existing = await db.tasks.where('estateId').equals(activeEstateId).toArray()
      const existingTitles = new Set(existing.map((task) => task.title.toLowerCase()))

      let created = 0
      let skipped = 0
      let fallbackWarning: string | null = null

      for (const deadline of computed) {
        if (existingTitles.has(deadline.title.toLowerCase())) {
          skipped += 1
          continue
        }

        if (!deadline.dueDate) {
          skipped += 1
          continue
        }

        try {
          await createTaskCloud({
            estateId: activeEstateId,
            title: deadline.title,
            description: deadline.description ?? '',
            due_date: deadline.dueDate.toISOString(),
            status: 'not-started',
            priority: 'med',
            tags: [deadline.tag],
            docIds: [],
          })
          created += 1
          existingTitles.add(deadline.title.toLowerCase())
        } catch (error) {
          if (isCloudFallbackError(error)) {
            created += 1
            existingTitles.add(deadline.title.toLowerCase())
            fallbackWarning = resolveCloudFallbackMessage(
              error,
              'Unable to generate checklist tasks.',
            )
          } else {
            throw error
          }
        }
      }

      setGenerateMessage(
        created > 0
          ? `Generated ${created} task${created === 1 ? '' : 's'}${
              skipped > 0 ? ` (skipped ${skipped} existing reminder${skipped === 1 ? '' : 's'})` : ''
            }.`
          : 'All default tasks already exist.',
      )
      setErrorMessage(fallbackWarning)
    } catch (error) {
      console.error(error)
      const message = isCloudFallbackError(error)
        ? resolveCloudFallbackMessage(error, 'Unable to generate checklist tasks.')
        : getErrorMessage(error, 'Unable to generate checklist tasks.')
      setErrorMessage(message)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleExportData = async () => {
    setDataStatusMessage(null)
    setDataErrorMessage(null)
    setIsExporting(true)

    try {
      const payload = await exportWorkspaceData()
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      })
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      const timestamp = new Date().toISOString().replace(/[:]/g, '-').split('.')[0]
      anchor.href = objectUrl
      anchor.download = `estate-workspace-${timestamp}.json`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(objectUrl)
      setDataStatusMessage('Exported workspace data. Check your downloads folder for the JSON file.')
    } catch (error) {
      console.error(error)
      setDataErrorMessage(getErrorMessage(error, 'Unable to export workspace data.'))
    } finally {
      setIsExporting(false)
    }
  }

  const handleImportClick = () => {
    setDataStatusMessage(null)
    setDataErrorMessage(null)
    importInputRef.current?.click()
  }

  const handleImportFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    event.target.value = ''
    if (!file) return

    setIsImporting(true)
    setDataStatusMessage(null)
    setDataErrorMessage(null)

    try {
      const content = await file.text()
      const parsed = JSON.parse(content) as WorkspaceExportPayload
      await importWorkspaceData(parsed)
      hydrateSetup()
      setStatusMessage('Loaded estate profile from imported data.')
      setGenerateMessage(null)
      setErrorMessage(null)
      setDataStatusMessage('Imported workspace data successfully.')
    } catch (error) {
      console.error(error)
      setDataErrorMessage(
        getErrorMessage(error, 'Unable to import data. Confirm the file was exported from Estate.'),
      )
    } finally {
      setIsImporting(false)
    }
  }

  const handleResetDemoData = async () => {
    setIsResetting(true)
    setDataStatusMessage(null)
    setDataErrorMessage(null)

    try {
      await resetDemoData()
      hydrateSetup()
      setStatusMessage('Loaded demo estate profile.')
      setGenerateMessage(null)
      setErrorMessage(null)
      setDataStatusMessage('Demo data restored. Sample tasks, documents, and journal entries are ready to explore.')
    } catch (error) {
      console.error(error)
      setDataErrorMessage(getErrorMessage(error, 'Unable to reset demo data.'))
    } finally {
      setIsResetting(false)
    }
  }

  const openPlanModal = () => {
    setPlanImportError(null)
    setPlanInput('')
    setIsPlanModalOpen(true)
  }

  const closePlanModal = () => {
    if (isPlanImporting) return
    setIsPlanModalOpen(false)
    setPlanInput('')
    setPlanImportError(null)
  }

  const handlePlanImport = async () => {
    if (!planInput.trim()) {
      setPlanImportError('Paste the plan JSON before importing.')
      return
    }

    setIsPlanImporting(true)
    setPlanImportError(null)

    try {
      const coerced = coercePlan(planInput)
      const parsed = PlanV2.safeParse(coerced)
      if (!parsed.success) {
        const details = parsed.error.issues
          .slice(0, 5)
          .map((issue) => {
            const path = issue.path.join('.') || '(root)'
            return `• ${path} — ${issue.message}`
          })
          .join('\n')
        throw new Error(`Invalid plan JSON:\n${details}`)
      }

      const plan = parsed.data

      if (authMode === 'supabase') {
        await importPlanToCloud(plan)
        refreshEstateProfiles()
        notifyPlanUpdated()
        setSeedVersion(plan.seedVersion)
        setStatusMessage(null)
        setGenerateMessage(null)
        setErrorMessage(null)
        setDataStatusMessage(null)
        setDataErrorMessage(null)
        setToastMessage('Plan imported')
        setIsPlanModalOpen(false)
        setPlanInput('')
        setPlanImportError(null)
        navigate('/tasks')
        return
      }

      const profilesRec = Object.fromEntries(plan.profiles.map((profile) => [profile.id, profile]))
      saveEstateProfiles(profilesRec)
      saveSeedVersion(plan.seedVersion)

      if (typeof window !== 'undefined') {
        const guidanceForEstate = (estateId: string) =>
          plan.guidance.filter((entry) => entry.estateId === estateId)
        for (const profile of plan.profiles) {
          const guidanceEntries = guidanceForEstate(profile.id)
          window.localStorage.setItem(`guidance:${profile.id}`, JSON.stringify(guidanceEntries))

          const seeds = plan.seedTasks
            .filter((task) => task.estateId === profile.id)
            .map((task) => {
              const { estateId, ...rest } = task
              void estateId
              return rest
            })
          window.localStorage.setItem(`seedTasks:${profile.id}`, JSON.stringify(seeds))
        }

        const currentActive = window.localStorage.getItem('estateActiveId')
        if (!currentActive) {
          window.localStorage.setItem('estateActiveId', plan.profiles[0].id)
        }
      }

      reseedFromPlan(plan)
      notifyPlanUpdated()
      refreshEstateProfiles()
      setSeedVersion(plan.seedVersion)
      setStatusMessage(null)
      setGenerateMessage(null)
      setErrorMessage(null)
      setDataStatusMessage(null)
      setDataErrorMessage(null)
      setToastMessage('Plan imported')
      setIsPlanModalOpen(false)
      setPlanInput('')
      setPlanImportError(null)
      navigate('/tasks')
    } catch (error) {
      console.error(error)
      const message = getErrorMessage(error, 'Unable to import plan')
      setPlanImportError(message)
    } finally {
      setIsPlanImporting(false)
    }
  }

  return (
    <section className="space-y-10">
      <header className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary-600">Workspace</p>
        <h1 className="text-3xl font-semibold text-slate-900">Profile &amp; settings</h1>
        <p className="max-w-2xl text-sm text-slate-500">
          Capture key docket dates to personalize reminders and manage local data for the Estate demo workspace.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
        <div className="space-y-6">
          <CloudBanner />
          <article className="card-surface space-y-5">
            <header className="space-y-1">
              <h2 className="text-xl font-semibold text-slate-900">Cloud</h2>
              <p className="text-sm text-slate-500">
                Configure Supabase credentials to connect your workspace to the cloud and keep data in sync across devices.
              </p>
            </header>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="cloudUrl" className="text-sm font-semibold text-slate-700">
                  Supabase URL
                </label>
                <input
                  id="cloudUrl"
                  type="url"
                  placeholder="https://your-project.supabase.co"
                  value={cloudUrl}
                  onChange={handleCloudUrlChange}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="cloudAnonKey" className="text-sm font-semibold text-slate-700">
                  Supabase anon key
                </label>
                <textarea
                  id="cloudAnonKey"
                  rows={3}
                  placeholder="eyJhbGciOi..."
                  value={cloudAnonKey}
                  onChange={handleCloudAnonKeyChange}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 shadow-inner focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200"
                />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-xs text-slate-600">
                <p className="font-semibold text-slate-700">{cloudValidationMessage}</p>
                <p className="mt-1 leading-relaxed">
                  {safeMode
                    ? 'Safe mode keeps everything local. Enable cloud to recheck your Supabase keys.'
                    : cloudReady
                    ? 'Supabase authentication is active. Sign out to switch accounts or update your keys.'
                    : 'Enter your Supabase project URL and anon key, then save to enable cloud sync and Supabase sign-in.'}
                </p>
              </div>
              {cloudFeedback ? <p className="text-sm text-primary-600">{cloudFeedback}</p> : null}
              {cloudFeedbackError ? <p className="text-sm text-rose-600">{cloudFeedbackError}</p> : null}
              {dataMigrationStatus ? <p className="text-sm text-primary-600">{dataMigrationStatus}</p> : null}
              {dataMigrationError ? <p className="text-sm text-rose-600">{dataMigrationError}</p> : null}
              {migrationStatus ? <p className="text-sm text-primary-600">{migrationStatus}</p> : null}
              {migrationError ? <p className="text-sm text-rose-600">{migrationError}</p> : null}
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleCloudSave}
                  disabled={isCloudSaving}
                  className="rounded-full bg-primary-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isCloudSaving ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={handleCloudSignIn}
                  className="rounded-full border border-primary-200 px-5 py-2 text-sm font-semibold text-primary-700 transition hover:border-primary-300 hover:bg-primary-50"
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={handleCloudSignOut}
                  disabled={isCloudSigningOut}
                  className="rounded-full border border-rose-200 px-5 py-2 text-sm font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isCloudSigningOut ? 'Signing out…' : 'Sign out'}
                </button>
                <button
                  type="button"
                  onClick={handleDisableCloudSafeMode}
                  disabled={safeMode}
                  className="rounded-full border border-amber-200 px-5 py-2 text-sm font-semibold text-amber-700 transition hover:border-amber-300 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Disable Cloud (Safe Mode)
                </button>
                <button
                  type="button"
                  onClick={handleEnableCloudMode}
                  disabled={!safeMode}
                  className="rounded-full border border-emerald-200 px-5 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Enable Cloud
                </button>
                <button
                  type="button"
                  onClick={handleClearCloudKeys}
                  className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Clear Cloud Keys
                </button>
                <button
                  type="button"
                  onClick={handleMigrateWorkspace}
                  disabled={isMigratingData || authMode !== 'supabase' || !isAuthenticated}
                  className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 transition hover:border-primary-300 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isMigratingData ? 'Migrating…' : 'Migrate local data now'}
                </button>
                <button
                  type="button"
                  onClick={handleMigrateDocuments}
                  disabled={isMigratingDocs || authMode !== 'supabase' || !isAuthenticated}
                  className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 transition hover:border-primary-300 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isMigratingDocs ? 'Migrating…' : 'Migrate local documents to cloud'}
                </button>
              </div>
            </div>
          </article>
          <article className="card-surface space-y-5">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Estate plans</h2>
                <p className="text-sm text-slate-500">
                  Switch between estates to view tailored tasks, documents, and guidance.
                </p>
              </div>
              <button
                type="button"
                onClick={openPlanModal}
                className="rounded-full border border-primary-200 bg-white px-4 py-2 text-sm font-semibold text-primary-700 transition hover:border-primary-300 hover:bg-primary-50"
              >
                Import plan
              </button>
            </header>
            <div className="grid gap-3 sm:grid-cols-2">
              {ESTATE_IDS.map((id) => {
                const profile = estateProfiles[id]
                const isActive = id === activeEstateId
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveEstateId(id)}
                    aria-pressed={isActive}
                    className={`rounded-2xl border px-4 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
                      isActive
                        ? 'border-primary-400 bg-primary-50 shadow-sm shadow-primary-100'
                        : 'border-slate-200 bg-white hover:border-primary-200 hover:bg-primary-50/70'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-700">{profile.label}</p>
                      {isActive ? (
                        <span className="rounded-full bg-primary-500 px-2 py-0.5 text-xs font-semibold text-white">
                          Active
                        </span>
                      ) : null}
                    </div>
                    <dl className="mt-3 space-y-1 text-xs text-slate-600">
                      <div className="flex justify-between gap-2">
                        <dt className="font-medium text-slate-500">Decedent</dt>
                        <dd className="text-right text-slate-700">{profile.decedentName || 'Not set'}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="font-medium text-slate-500">County</dt>
                        <dd className="text-right text-slate-700">
                          {profile.county ? `${profile.county} County` : 'Not set'}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="font-medium text-slate-500">Date of death</dt>
                        <dd className="text-right text-slate-700">{formatPlanDate(profile.dodISO)}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="font-medium text-slate-500">Letters</dt>
                        <dd className="text-right text-slate-700">{formatPlanDate(profile.lettersISO)}</dd>
                      </div>
                    </dl>
                  </button>
                )
              })}
            </div>
            {seedVersion ? (
              <p className="text-xs text-slate-500">
                Last imported seed version{' '}
                <span className="font-semibold text-slate-700">{seedVersion}</span>
              </p>
            ) : null}
          </article>
          <article className="card-surface space-y-6">
            <header className="space-y-1">
              <h2 className="text-xl font-semibold text-slate-900">Estate timeline</h2>
              <p className="text-sm text-slate-500">
                Enter milestone dates to unlock recommended reminders and populate the checklist with suggested tasks.
              </p>
            </header>

            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="dateOfDeath" className="text-sm font-semibold text-slate-700">
                    Date of death
                  </label>
                  <input
                    id="dateOfDeath"
                    name="dateOfDeath"
                    type="date"
                    required
                    value={formState.dateOfDeath}
                    onChange={handleFormChange}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm shadow-sm transition focus:border-primary-400"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="lettersGranted" className="text-sm font-semibold text-slate-700">
                    Letters granted
                  </label>
                  <input
                    id="lettersGranted"
                    name="lettersGranted"
                    type="date"
                    required
                    value={formState.lettersGranted}
                    onChange={handleFormChange}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm shadow-sm transition focus:border-primary-400"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="firstPublication" className="text-sm font-semibold text-slate-700">
                    First publication (optional)
                  </label>
                  <input
                    id="firstPublication"
                    name="firstPublication"
                    type="date"
                    value={formState.firstPublication}
                    onChange={handleFormChange}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm shadow-sm transition focus:border-primary-400"
                  />
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                  <label htmlFor="estate1041Required" className="flex items-start gap-3 text-sm text-slate-700">
                    <input
                      id="estate1041Required"
                      name="estate1041Required"
                      type="checkbox"
                      checked={formState.estate1041Required}
                      onChange={handleFormChange}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600"
                    />
                    <span>
                      Estate expects to file Form 1041
                      <span className="mt-1 block text-xs text-slate-500">
                        Uncheck if the estate has no fiduciary income tax filing obligation.
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSaving ? 'Saving…' : 'Save setup'}
                </button>
                <button
                  type="button"
                  onClick={handleGenerateChecklist}
                  disabled={isGenerating}
                  className="rounded-full border border-primary-200 bg-primary-50 px-5 py-2.5 text-sm font-semibold text-primary-700 transition hover:border-primary-300 hover:text-primary-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isGenerating ? 'Creating…' : 'Generate default checklist'}
                </button>
              </div>

              {statusMessage && <p className="text-sm text-emerald-600">{statusMessage}</p>}
              {generateMessage && <p className="text-sm text-primary-700">{generateMessage}</p>}
              {errorMessage && <p className="text-sm text-rose-600">{errorMessage}</p>}
            </form>
          </article>

          <article className="card-surface space-y-6">
            <header className="space-y-1">
              <h2 className="text-xl font-semibold text-slate-900">Workspace data</h2>
              <p className="text-sm text-slate-500">
                Export your tasks, document metadata and files, journal entries, and estate profile—or restore the built-in demo content.
              </p>
            </header>

            <div className="space-y-4">
              <p className="rounded-2xl bg-slate-50/80 p-4 text-sm text-slate-600">
                Exports are saved as a JSON file that you can re-import later. Imports replace the data currently stored on this device.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleExportData}
                  disabled={isExporting}
                  className="rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isExporting ? 'Preparing export…' : 'Export workspace'}
                </button>
                <button
                  type="button"
                  onClick={handleImportClick}
                  disabled={isImporting}
                  className="rounded-full border border-primary-200 bg-white px-5 py-2.5 text-sm font-semibold text-primary-700 transition hover:border-primary-300 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isImporting ? 'Importing…' : 'Import from file'}
                </button>
                <button
                  type="button"
                  onClick={handleResetDemoData}
                  disabled={isResetting}
                  className="rounded-full border border-slate-300 bg-slate-50 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isResetting ? 'Restoring…' : 'Reset demo data'}
                </button>
              </div>
              {dataStatusMessage && <p className="text-sm text-emerald-600">{dataStatusMessage}</p>}
              {dataErrorMessage && <p className="text-sm text-rose-600">{dataErrorMessage}</p>}
            </div>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={handleImportFileChange}
            />
          </article>
        </div>

        <article className="card-surface space-y-6">
          <header className="space-y-1">
            <h2 className="text-xl font-semibold text-slate-900">Suggested due dates</h2>
            <p className="text-sm text-slate-500">
              Deadlines adjust automatically based on the dates provided. Generate the checklist to add them as tasks with workstream tags.
            </p>
          </header>

          {deadlines.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-5 text-sm text-slate-500">
              Add the date of death and letters granted to preview recommended deadlines.
            </p>
          ) : (
            <ul className="space-y-4">
              {deadlines.map((deadline) => (
                <li
                  key={deadline.key}
                  className="rounded-2xl border border-slate-200 p-4 text-sm shadow-sm transition hover:border-primary-200/70"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{deadline.title}</p>
                      <p className="text-xs uppercase tracking-wide text-primary-600">{deadline.tag}</p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        deadline.dueDate ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {formatDeadlineDate(deadline.dueDate)}
                    </span>
                  </div>
                  {deadline.description && (
                    <p className="mt-3 text-xs leading-relaxed text-slate-500">{deadline.description}</p>
                  )}
                  {deadline.optional && !deadline.dueDate && (
                    <p className="mt-3 text-xs font-medium text-amber-600">Marked as not applicable.</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
      {isPlanModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 px-4 py-6">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
            <header className="mb-4 space-y-1">
              <h2 className="text-lg font-semibold text-slate-900">Import estate plan</h2>
              <p className="text-sm text-slate-500">
                Paste the JSON configuration to load profiles, seeded tasks, documents, and guidance into this device.
              </p>
            </header>
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-xs font-semibold text-primary-600 transition hover:text-primary-700"
                  onClick={() => {
                    setPlanInput(SAMPLE_PLAN)
                    setPlanImportError(null)
                  }}
                  disabled={isPlanImporting}
                >
                  Show sample JSON
                </button>
              </div>
              <textarea
                value={planInput}
                onChange={(event) => {
                  setPlanInput(event.target.value)
                  setPlanImportError(null)
                }}
                rows={10}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 shadow-inner focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200"
                placeholder={'{"seedVersion":"v2","estateProfiles":{...}}'}
              />
              {planImportError ? <p className="text-sm text-rose-600">{planImportError}</p> : null}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closePlanModal}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-100"
                  disabled={isPlanImporting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePlanImport}
                  disabled={isPlanImporting}
                  className="rounded-full bg-primary-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isPlanImporting ? 'Importing…' : 'Import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {toastMessage ? (
        <div className="fixed bottom-24 left-1/2 z-30 -translate-x-1/2 rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-lg">
          {toastMessage}
        </div>
      ) : null}
    </section>
  )
}


export default Profile
