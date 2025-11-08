import { ChangeEvent, FormEvent, useState } from 'react'
import { FaDownload, FaFileImport, FaListAlt } from 'react-icons/fa'
import { useDataContext } from '../contexts/useDataContext'
import { defaultTasks } from '../utils/constants'
import { downloadFile } from '../utils/exporters'
import { calculateDeadlines, formatDate } from '../utils/dates'
import { AppData } from '../types'

const estateFields = [
  { key: 'estateName', label: 'Estate name / caption', placeholder: 'Estate of Jane Doe' },
  { key: 'decedentName', label: 'Decedent name', placeholder: 'Jane Doe' },
  { key: 'docketNumber', label: 'Docket number', placeholder: '150-23-1234' },
  { key: 'county', label: 'County', placeholder: 'Chester County, PA' },
  { key: 'attorneyName', label: 'Attorney', placeholder: 'Counsel name (optional)' }
] as const

export const SettingsPage = () => {
  const { data, updateEstateInfo, replaceTasks, restoreData, markChecklistSeeded } = useDataContext()

  const [notes, setNotes] = useState(data.estateInfo.notes ?? '')

  const deadlines = calculateDeadlines(data.estateInfo)

  const handleFieldChange = (key: typeof estateFields[number]['key'], value: string) => {
    updateEstateInfo({ [key]: value })
  }

  const handleDateChange = (key: 'dateOfDeath' | 'lettersGrantedDate' | 'firstAdvertisementDate', value: string) => {
    updateEstateInfo({ [key]: value || undefined })
  }

  const handleNotesSubmit = (event: FormEvent) => {
    event.preventDefault()
    updateEstateInfo({ notes: notes || undefined })
  }

  const handleLoadChecklist = () => {
    const tasks = defaultTasks()
    replaceTasks(tasks)
    markChecklistSeeded()
  }

  const handleExportBackup = () => {
    const payload: AppData = {
      ...data,
      estateInfo: { ...data.estateInfo, notes }
    }
    downloadFile(JSON.stringify(payload, null, 2), 'estate-dashboard-backup.json', 'application/json')
  }

  const handleImportBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const text = await file.text()
    try {
      const parsed = JSON.parse(text) as AppData
      restoreData(parsed)
      setNotes(parsed.estateInfo?.notes ?? '')
    } catch (error) {
      alert('Unable to import backup. Please ensure the file is a valid export.')
    }
  }

  return (
    <div className="page settings">
      <section className="card">
        <div className="section-header">
          <h2>Estate Profile</h2>
        </div>
        <form className="form grid" onSubmit={handleNotesSubmit}>
          {estateFields.map((field) => (
            <label key={field.key}>
              <span>{field.label}</span>
              <input
                value={(data.estateInfo as Record<string, string | undefined>)[field.key] ?? ''}
                onChange={(event) => handleFieldChange(field.key, event.target.value)}
                placeholder={field.placeholder}
              />
            </label>
          ))}
          <label>
            <span>Date of death</span>
            <input type="date" value={data.estateInfo.dateOfDeath ?? ''} onChange={(event) => handleDateChange('dateOfDeath', event.target.value)} />
          </label>
          <label>
            <span>Letters granted</span>
            <input type="date" value={data.estateInfo.lettersGrantedDate ?? ''} onChange={(event) => handleDateChange('lettersGrantedDate', event.target.value)} />
          </label>
          <label>
            <span>First advertisement</span>
            <input type="date" value={data.estateInfo.firstAdvertisementDate ?? ''} onChange={(event) => handleDateChange('firstAdvertisementDate', event.target.value)} />
          </label>
          <label className="full-width">
            <span>Estate notes</span>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} placeholder="Court contact information, banking details, reminders" />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn primary">
              Save profile notes
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <div className="section-header">
          <h2>Pennsylvania Statutory Deadlines</h2>
        </div>
        <ul className="deadline-list">
          <li>
            <strong>Rule 10.5 notice deadline:</strong> {deadlines.heirNotice ? formatDate(deadlines.heirNotice) : 'Enter letters granted date'}
          </li>
          <li>
            <strong>Inventory filing deadline:</strong> {deadlines.inventoryDue ? formatDate(deadlines.inventoryDue) : 'Enter date of death'}
          </li>
          <li>
            <strong>Inheritance tax return due:</strong> {deadlines.inheritanceTax ? formatDate(deadlines.inheritanceTax) : 'Enter date of death'}
          </li>
          <li>
            <strong>5% tax discount window:</strong> {deadlines.inheritanceTaxDiscount ? formatDate(deadlines.inheritanceTaxDiscount) : 'Enter date of death'}
          </li>
          <li>
            <strong>Creditor claim bar date:</strong> {deadlines.creditorBar ? formatDate(deadlines.creditorBar) : 'Enter advertisement date'}
          </li>
        </ul>
      </section>

      <section className="card">
        <div className="section-header">
          <h2>Data Management</h2>
        </div>
        <div className="button-row">
          <button type="button" className="btn" onClick={handleLoadChecklist}>
            <FaListAlt /> Load Pennsylvania checklist
          </button>
          <button type="button" className="btn" onClick={handleExportBackup}>
            <FaDownload /> Export backup
          </button>
          <label className="btn">
            <FaFileImport /> Import backup
            <input
              type="file"
              accept="application/json"
              onChange={(event) => {
                void handleImportBackup(event)
              }}
              hidden
            />
          </label>
        </div>
        <p className="help-text">
          Use the backup feature to save a JSON copy of your tasks, documents (metadata), assets, expenses, beneficiaries, and reminders. Your information is saved on the estate dashboard server, but exporting ensures you keep a personal copy before making major changes.
        </p>
      </section>
    </div>
  )
}
