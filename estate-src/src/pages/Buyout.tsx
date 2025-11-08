import { useEffect, useMemo, useState } from 'react'
import { useEstate } from '../context/EstateContext'
import type { BuyoutLineItem, BuyoutWorksheetData } from '../types/buyout'
import { loadBuyoutWorksheet, saveBuyoutWorksheet } from '../storage/buyoutWorksheet'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const formatCurrency = (value: number) =>
  currencyFormatter.format(Number.isFinite(value) ? value : 0)

const parseNumericInput = (value: string) => {
  if (!value) return 0
  const normalized = value.replace(/[^0-9.-]/g, '')
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

const generateId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10)

const createLineItem = (description = ''): BuyoutLineItem => ({
  id: generateId(),
  description,
  amount: '',
})

const withDefaults = (data: BuyoutWorksheetData): BuyoutWorksheetData => {
  const credits = (Array.isArray(data.credits) ? data.credits : []).map((item) => ({
    id: item.id || generateId(),
    description: item.description ?? '',
    amount: item.amount ?? '',
  }))

  const adjustments = (Array.isArray(data.adjustments) ? data.adjustments : []).map((item) => ({
    id: item.id || generateId(),
    description: item.description ?? '',
    amount: item.amount ?? '',
  }))

  if (credits.length === 0) {
    credits.push(createLineItem('Funeral & administration expenses advanced'))
  }

  return {
    appraisedValue: data.appraisedValue ?? '',
    sharePercent: data.sharePercent ?? '50',
    credits,
    adjustments,
  }
}

const buildSummaryText = (
  estateLabel: string,
  sharePercentDisplay: string,
  grossDue: number,
  totalCredits: number,
  totalAdjustments: number,
  netDue: number,
  credits: BuyoutLineItem[],
  adjustments: BuyoutLineItem[],
) => {
  const lines: string[] = []

  lines.push(`Buyout worksheet for ${estateLabel}`)
  lines.push(`Sister share: ${sharePercentDisplay || '—'}%`)
  lines.push(`Gross due: ${formatCurrency(grossDue)}`)

  if (credits.length > 0) {
    lines.push('Credits (amounts reduce payment):')
    credits.forEach((credit) => {
      if (!credit.description && !credit.amount) return
      const amount = formatCurrency(parseNumericInput(credit.amount))
      const label = credit.description || 'Credit'
      lines.push(`  • ${label}: ${amount}`)
    })
    lines.push(`Total credits: ${formatCurrency(totalCredits)}`)
  } else {
    lines.push('Credits: none')
  }

  if (adjustments.length > 0) {
    lines.push('Adjustments (positive increases payment, negative reduces):')
    adjustments.forEach((adjustment) => {
      if (!adjustment.description && !adjustment.amount) return
      const amount = formatCurrency(parseNumericInput(adjustment.amount))
      const label = adjustment.description || 'Adjustment'
      lines.push(`  • ${label}: ${amount}`)
    })
    lines.push(`Total adjustments: ${formatCurrency(totalAdjustments)}`)
  } else {
    lines.push('Adjustments: none')
  }

  lines.push(`Net payment due to sister: ${formatCurrency(netDue)}`)
  lines.push('Informational only; court approval or written consent may be required (20 Pa.C.S. §3356).')

  return lines.join('\n')
}

const toCsv = (
  estateLabel: string,
  sharePercentDisplay: string,
  propertyValue: number,
  grossDue: number,
  credits: BuyoutLineItem[],
  totalCredits: number,
  adjustments: BuyoutLineItem[],
  totalAdjustments: number,
  netDue: number,
) => {
  const rows: string[][] = []
  rows.push(['Buyout worksheet for', estateLabel])
  rows.push(['Appraised value', formatCurrency(propertyValue)])
  rows.push(['Sister share %', sharePercentDisplay || '0'])
  rows.push(['Gross due', formatCurrency(grossDue)])
  rows.push([])
  rows.push(['Credits (reduce payment)', 'Amount'])

  if (credits.length === 0) {
    rows.push(['None', formatCurrency(0)])
  } else {
    credits.forEach((credit) => {
      if (!credit.description && !credit.amount) return
      rows.push([credit.description || 'Credit', formatCurrency(parseNumericInput(credit.amount))])
    })
  }

  rows.push(['Total credits', formatCurrency(totalCredits)])
  rows.push([])
  rows.push(['Adjustments', 'Amount'])

  if (adjustments.length === 0) {
    rows.push(['None', formatCurrency(0)])
  } else {
    adjustments.forEach((adjustment) => {
      if (!adjustment.description && !adjustment.amount) return
      rows.push([adjustment.description || 'Adjustment', formatCurrency(parseNumericInput(adjustment.amount))])
    })
  }

  rows.push(['Total adjustments', formatCurrency(totalAdjustments)])
  rows.push([])
  rows.push(['Net payment due to sister', formatCurrency(netDue)])

  const escapeCell = (cell: string) => {
    if (cell === undefined || cell === null) return ''
    const needsQuotes = /[",\n]/.test(cell)
    const value = cell.replace(/"/g, '""')
    return needsQuotes ? `"${value}"` : value
  }

  return rows
    .map((row) => row.map((cell) => escapeCell(String(cell ?? ''))).join(','))
    .join('\r\n')
}

const Buyout = () => {
  const { activeEstateId, estateProfiles } = useEstate()
  const estateLabel = estateProfiles[activeEstateId]?.label || 'Selected estate'
  const [data, setData] = useState<BuyoutWorksheetData>(() =>
    withDefaults({ appraisedValue: '', sharePercent: '50', credits: [createLineItem()], adjustments: [] }),
  )
  const [isReady, setIsReady] = useState(false)
  const [copyStatus, setCopyStatus] = useState<string | null>(null)

  useEffect(() => {
    setIsReady(false)
    const stored = loadBuyoutWorksheet(activeEstateId)
    setData(withDefaults(stored))
    setIsReady(true)
  }, [activeEstateId])

  useEffect(() => {
    if (!isReady) return
    saveBuyoutWorksheet(activeEstateId, data)
  }, [activeEstateId, data, isReady])

  useEffect(() => {
    if (!copyStatus) return
    const timeout = window.setTimeout(() => setCopyStatus(null), 3000)
    return () => window.clearTimeout(timeout)
  }, [copyStatus])

  const propertyValue = parseNumericInput(data.appraisedValue)
  const sharePercentValue = (() => {
    if (!data.sharePercent) return 0
    const parsed = Number.parseFloat(data.sharePercent)
    if (!Number.isFinite(parsed)) return 0
    if (parsed < 0) return 0
    if (parsed > 100) return 100
    return parsed
  })()

  const grossDue = useMemo(() => propertyValue * (sharePercentValue / 100), [propertyValue, sharePercentValue])

  const totalCredits = useMemo(
    () => data.credits.reduce((sum, credit) => sum + parseNumericInput(credit.amount), 0),
    [data.credits],
  )

  const totalAdjustments = useMemo(
    () => data.adjustments.reduce((sum, adjustment) => sum + parseNumericInput(adjustment.amount), 0),
    [data.adjustments],
  )

  const netDue = useMemo(() => grossDue - totalCredits + totalAdjustments, [grossDue, totalCredits, totalAdjustments])

  const sharePercentDisplay = data.sharePercent

  const handleValueChange = (value: string) => {
    setData((prev) => ({ ...prev, appraisedValue: value }))
  }

  const handleShareChange = (value: string) => {
    setData((prev) => ({ ...prev, sharePercent: value }))
  }

  const updateCredits = (id: string, updates: Partial<BuyoutLineItem>) => {
    setData((prev) => ({
      ...prev,
      credits: prev.credits.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    }))
  }

  const updateAdjustments = (id: string, updates: Partial<BuyoutLineItem>) => {
    setData((prev) => ({
      ...prev,
      adjustments: prev.adjustments.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    }))
  }

  const addCredit = () => {
    setData((prev) => ({ ...prev, credits: [...prev.credits, createLineItem('')] }))
  }

  const addAdjustment = () => {
    setData((prev) => ({ ...prev, adjustments: [...prev.adjustments, createLineItem('')] }))
  }

  const removeCredit = (id: string) => {
    setData((prev) => {
      if (prev.credits.length <= 1) {
        return {
          ...prev,
          credits: prev.credits.map((item) =>
            item.id === id ? { ...item, description: '', amount: '' } : item,
          ),
        }
      }
      return { ...prev, credits: prev.credits.filter((item) => item.id !== id) }
    })
  }

  const removeAdjustment = (id: string) => {
    setData((prev) => ({
      ...prev,
      adjustments: prev.adjustments.filter((item) => item.id !== id),
    }))
  }

  const handleCopySummary = async () => {
    const summary = buildSummaryText(
      estateLabel,
      sharePercentDisplay,
      grossDue,
      totalCredits,
      totalAdjustments,
      netDue,
      data.credits,
      data.adjustments,
    )

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(summary)
      } else {
        throw new Error('Clipboard API unavailable')
      }
      setCopyStatus('Summary copied to clipboard')
    } catch (error) {
      console.error(error)
      try {
        const textarea = document.createElement('textarea')
        textarea.value = summary
        textarea.setAttribute('readonly', '')
        textarea.style.position = 'absolute'
        textarea.style.left = '-9999px'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
        setCopyStatus('Summary copied to clipboard')
      } catch (fallbackError) {
        console.error(fallbackError)
        setCopyStatus('Unable to copy summary')
      }
    }
  }

  const handleDownloadCsv = () => {
    const csv = toCsv(
      estateLabel,
      sharePercentDisplay,
      propertyValue,
      grossDue,
      data.credits,
      totalCredits,
      data.adjustments,
      totalAdjustments,
      netDue,
    )

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `buyout-worksheet-${activeEstateId}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    setCopyStatus('CSV downloaded')
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary-500">Worksheet</p>
        <h1 className="text-3xl font-semibold text-slate-900">Buyout worksheet</h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Estimate the net amount owed to a sibling when you purchase their share of the estate home.
          Numbers update automatically and save per estate.
        </p>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-amber-900">
        <p className="text-sm font-semibold uppercase tracking-wide">Disclaimer</p>
        <p className="text-sm">
          Informational only; court approval or written consent may be required (20 Pa.C.S. §3356).
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <header className="space-y-1">
              <h2 className="text-lg font-semibold text-slate-900">1. Property value &amp; sister&apos;s share</h2>
              <p className="text-sm text-slate-500">
                Use the date-of-death appraisal or any agreed value with your sibling.
              </p>
            </header>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm font-medium text-slate-700">
                <span>Appraised / agreed value</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={data.appraisedValue}
                  onChange={(event) => handleValueChange(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 shadow-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-200/60"
                  placeholder="$300,000"
                />
              </label>

              <label className="space-y-1 text-sm font-medium text-slate-700">
                <span>Percent owed to sister</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={data.sharePercent}
                  onChange={(event) => handleShareChange(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 shadow-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-200/60"
                  placeholder="50"
                />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <header className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">2. Credits you advanced</h2>
                <p className="text-sm text-slate-500">
                  List funeral, administration, utilities (to date of death), and property preservation expenses you covered.
                </p>
              </div>
              <button
                type="button"
                onClick={addCredit}
                className="rounded-full border border-primary-200 px-4 py-2 text-sm font-medium text-primary-600 transition hover:bg-primary-50"
              >
                + Add credit
              </button>
            </header>

            <div className="mt-4 space-y-4">
              {data.credits.map((credit, index) => (
                <div key={credit.id} className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center">
                    <label className="flex-1 space-y-1 text-sm font-medium text-slate-700">
                      <span>{`Description ${index + 1}`}</span>
                      <input
                        type="text"
                        value={credit.description}
                        onChange={(event) => updateCredits(credit.id, { description: event.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 shadow-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-200/60"
                        placeholder="Funeral bill paid to ABC Funeral Home"
                      />
                    </label>
                    <label className="w-full md:w-44 space-y-1 text-sm font-medium text-slate-700">
                      <span>Amount</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={credit.amount}
                        onChange={(event) => updateCredits(credit.id, { amount: event.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 shadow-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-200/60"
                        placeholder="$1,200"
                      />
                    </label>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeCredit(credit.id)}
                      className="text-sm font-medium text-rose-600 transition hover:text-rose-500"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <header className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">3. Agreed adjustments</h2>
                <p className="text-sm text-slate-500">
                  Include any other adjustments you agreed upon. Enter positive amounts to increase what you owe or negative amounts to reduce it.
                </p>
              </div>
              <button
                type="button"
                onClick={addAdjustment}
                className="rounded-full border border-primary-200 px-4 py-2 text-sm font-medium text-primary-600 transition hover:bg-primary-50"
              >
                + Add adjustment
              </button>
            </header>

            <div className="mt-4 space-y-4">
              {data.adjustments.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-500">
                  No adjustments added yet.
                </p>
              ) : (
                data.adjustments.map((adjustment, index) => (
                  <div key={adjustment.id} className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center">
                      <label className="flex-1 space-y-1 text-sm font-medium text-slate-700">
                        <span>{`Description ${index + 1}`}</span>
                        <input
                          type="text"
                          value={adjustment.description}
                          onChange={(event) => updateAdjustments(adjustment.id, { description: event.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 shadow-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-200/60"
                          placeholder="Agreed credit for furniture you keep"
                        />
                      </label>
                      <label className="w-full md:w-44 space-y-1 text-sm font-medium text-slate-700">
                        <span>Amount</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={adjustment.amount}
                          onChange={(event) => updateAdjustments(adjustment.id, { amount: event.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 shadow-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-200/60"
                          placeholder="$500 or -$500"
                        />
                      </label>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeAdjustment(adjustment.id)}
                        className="text-sm font-medium text-rose-600 transition hover:text-rose-500"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200/80 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Settlement summary</h2>
              <p className="text-sm text-slate-500">Numbers recalculate instantly as you edit the worksheet.</p>
            </div>
            <div className="divide-y divide-slate-200/80">
              <div className="flex items-center justify-between px-6 py-4 text-sm text-slate-600">
                <span>Property value</span>
                <span className="font-medium text-slate-900">{formatCurrency(propertyValue)}</span>
              </div>
              <div className="flex items-center justify-between px-6 py-4 text-sm text-slate-600">
                <span>{`Sister share (${sharePercentDisplay || '0'}%)`}</span>
                <span className="font-medium text-slate-900">{formatCurrency(grossDue)}</span>
              </div>
              <div className="px-6 py-4 text-sm text-slate-600">
                <div className="flex items-baseline justify-between">
                  <span className="font-medium text-slate-700">Credits you advanced</span>
                  <span className="font-semibold text-emerald-600">- {formatCurrency(totalCredits)}</span>
                </div>
                <ul className="mt-2 space-y-1">
                  {data.credits.map((credit) => {
                    if (!credit.description && !credit.amount) return null
                    return (
                      <li key={credit.id} className="flex justify-between gap-2">
                        <span className="text-slate-500">{credit.description || 'Credit'}</span>
                        <span className="font-medium text-emerald-600">{formatCurrency(parseNumericInput(credit.amount))}</span>
                      </li>
                    )
                  })}
                </ul>
              </div>
              <div className="px-6 py-4 text-sm text-slate-600">
                <div className="flex items-baseline justify-between">
                  <span className="font-medium text-slate-700">Adjustments</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(totalAdjustments)}</span>
                </div>
                <ul className="mt-2 space-y-1">
                  {data.adjustments.map((adjustment) => {
                    if (!adjustment.description && !adjustment.amount) return null
                    const amount = parseNumericInput(adjustment.amount)
                    const amountClass = amount >= 0 ? 'text-slate-900' : 'text-emerald-600'
                    return (
                      <li key={adjustment.id} className="flex justify-between gap-2">
                        <span className="text-slate-500">{adjustment.description || 'Adjustment'}</span>
                        <span className={`font-medium ${amountClass}`}>{formatCurrency(amount)}</span>
                      </li>
                    )
                  })}
                </ul>
              </div>
              <div className="flex items-center justify-between px-6 py-5 text-base font-semibold text-slate-900">
                <span>Net payment due to sister</span>
                <span>{formatCurrency(netDue)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleCopySummary}
                className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500"
              >
                Copy summary
              </button>
              <button
                type="button"
                onClick={handleDownloadCsv}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-primary-200 hover:text-primary-600"
              >
                Download CSV
              </button>
              {copyStatus ? <span className="text-xs font-medium text-slate-500">{copyStatus}</span> : null}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default Buyout
