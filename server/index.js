import cors from 'cors'
import express from 'express'
import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATA_DIR = path.join(__dirname, 'data')
const DATA_FILE = path.join(DATA_DIR, 'app-data.json')

const defaultData = {
  tasks: [],
  documents: [],
  assets: [],
  expenses: [],
  beneficiaries: [],
  manualEvents: [],
  estateInfo: {},
  metadata: {
    checklistSeeded: false
  }
}

const normalizeData = (raw = {}) => ({
  ...defaultData,
  ...raw,
  tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
  documents: Array.isArray(raw.documents) ? raw.documents : [],
  assets: Array.isArray(raw.assets) ? raw.assets : [],
  expenses: Array.isArray(raw.expenses) ? raw.expenses : [],
  beneficiaries: Array.isArray(raw.beneficiaries) ? raw.beneficiaries : [],
  manualEvents: Array.isArray(raw.manualEvents) ? raw.manualEvents : [],
  estateInfo: typeof raw.estateInfo === 'object' && raw.estateInfo !== null ? raw.estateInfo : {},
  metadata:
    typeof raw.metadata === 'object' && raw.metadata !== null
      ? { ...defaultData.metadata, ...raw.metadata }
      : { ...defaultData.metadata }
})

const ensureDataDir = async () => {
  await mkdir(DATA_DIR, { recursive: true })
}

const loadData = async () => {
  try {
    const raw = await readFile(DATA_FILE, 'utf8')
    return normalizeData(JSON.parse(raw))
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      const data = normalizeData(defaultData)
      await saveData(data)
      return data
    }
    throw error
  }
}

const saveData = async (data) => {
  await ensureDataDir()
  const payload = normalizeData(data)
  payload.metadata.updatedAt = new Date().toISOString()
  await writeFile(DATA_FILE, JSON.stringify(payload, null, 2), 'utf8')
  return payload
}

const app = express()
const PORT = process.env.PORT ?? 3001

app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '15mb' }))

app.get('/api/data', async (req, res) => {
  try {
    const data = await loadData()
    res.json(data)
  } catch (error) {
    console.error('Failed to load data', error)
    res.status(500).json({ error: 'Failed to load saved data.' })
  }
})

app.put('/api/data', async (req, res) => {
  try {
    const saved = await saveData(req.body ?? {})
    res.json(saved)
  } catch (error) {
    console.error('Failed to save data', error)
    res.status(500).json({ error: 'Failed to save changes.' })
  }
})

app.listen(PORT, () => {
  console.log(`Estate dashboard API listening on port ${PORT}`)
})
