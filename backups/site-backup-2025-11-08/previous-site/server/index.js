import cors from 'cors'
import express from 'express'
import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } from 'crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATA_DIR = path.join(__dirname, 'data')
const DATA_FILE = path.join(DATA_DIR, 'app-data.json')
const USERS_FILE = path.join(DATA_DIR, 'users.json')

const DEFAULT_ACCOUNT_USERNAME = process.env.DEFAULT_ACCOUNT_USERNAME ?? 'matt'
const DEFAULT_ACCOUNT_PASSWORD = process.env.DEFAULT_ACCOUNT_PASSWORD ?? 'hippos1'

const parsedSessionTtl = Number(process.env.SESSION_TTL_MS)
const SESSION_TTL_MS = Number.isFinite(parsedSessionTtl) && parsedSessionTtl > 0 ? parsedSessionTtl : 1000 * 60 * 60 * 12

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

const readJsonFile = async (file) => {
  const raw = await readFile(file, 'utf8')
  return JSON.parse(raw)
}

const writeJsonFile = async (file, value) => {
  await ensureDataDir()
  await writeFile(file, JSON.stringify(value, null, 2), 'utf8')
}

const createPasswordHash = (password, salt) => {
  return pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex')
}

const createUserRecord = (username, password) => {
  const salt = randomBytes(16).toString('hex')
  const passwordHash = createPasswordHash(password, salt)
  const timestamp = new Date().toISOString()
  return {
    id: randomUUID(),
    username,
    salt,
    passwordHash,
    createdAt: timestamp,
    updatedAt: timestamp
  }
}

const ensureUsersFile = async () => {
  await ensureDataDir()
  let users = []
  let shouldPersist = false

  try {
    const stored = await readJsonFile(USERS_FILE)
    if (Array.isArray(stored)) {
      users = stored
    } else {
      shouldPersist = true
    }
  } catch (error) {
    if (!error || error.code !== 'ENOENT') {
      throw error
    }
    shouldPersist = true
  }

  const hasDefaultUser = users.some(
    (user) =>
      typeof user?.username === 'string' &&
      user.username.trim().toLowerCase() === DEFAULT_ACCOUNT_USERNAME.trim().toLowerCase()
  )

  if (!hasDefaultUser) {
    const defaultUser = createUserRecord(DEFAULT_ACCOUNT_USERNAME, DEFAULT_ACCOUNT_PASSWORD)
    users = [...users, defaultUser]
    shouldPersist = true
    console.info(`Created default administrator account for username "${DEFAULT_ACCOUNT_USERNAME}"`)
  }

  if (shouldPersist) {
    await writeJsonFile(USERS_FILE, users)
  }

  return users
}

const loadUsers = async () => {
  const users = await ensureUsersFile()
  if (Array.isArray(users)) {
    return users
  }
  return []
}

const saveUsers = async (users) => {
  await writeJsonFile(USERS_FILE, users)
}

const migrateLegacyData = async (defaultUserId) => {
  await ensureDataDir()
  try {
    const raw = await readJsonFile(DATA_FILE)
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      if (raw.users && typeof raw.users === 'object') {
        return
      }
      if (defaultUserId) {
        const migrated = normalizeData(raw)
        migrated.metadata.updatedAt = new Date().toISOString()
        const store = {
          users: {
            [defaultUserId]: migrated
          }
        }
        await writeJsonFile(DATA_FILE, store)
        return
      }
    }
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      await writeJsonFile(DATA_FILE, { users: {} })
      return
    }
    throw error
  }

  await writeJsonFile(DATA_FILE, { users: {} })
}

const loadDataStore = async () => {
  await ensureDataDir()
  try {
    const raw = await readJsonFile(DATA_FILE)
    if (raw && typeof raw === 'object' && !Array.isArray(raw) && raw.users && typeof raw.users === 'object') {
      return { users: raw.users }
    }
  } catch (error) {
    if (!error || error.code !== 'ENOENT') {
      throw error
    }
    await writeJsonFile(DATA_FILE, { users: {} })
  }
  return { users: {} }
}

const loadDataForUser = async (userId) => {
  const store = await loadDataStore()
  const existing = store.users[userId]
  if (existing) {
    return normalizeData(existing)
  }
  const initial = normalizeData(defaultData)
  initial.metadata.updatedAt = new Date().toISOString()
  store.users[userId] = initial
  await writeJsonFile(DATA_FILE, store)
  return initial
}

const saveDataForUser = async (userId, data) => {
  const store = await loadDataStore()
  const payload = normalizeData(data)
  payload.metadata.updatedAt = new Date().toISOString()
  store.users[userId] = payload
  await writeJsonFile(DATA_FILE, store)
  return payload
}

const sessions = new Map()

const pruneExpiredSessions = () => {
  const now = Date.now()
  for (const [token, session] of sessions.entries()) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(token)
    }
  }
}

const createSession = (user) => {
  pruneExpiredSessions()
  const token = randomUUID()
  sessions.set(token, {
    token,
    userId: user.id,
    username: user.username,
    createdAt: Date.now()
  })
  return token
}

const authenticateRequest = (req, res, next) => {
  pruneExpiredSessions()
  const header = req.get('authorization')
  if (!header || typeof header !== 'string') {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const matches = header.match(/^Bearer\s+(.+)$/)
  if (!matches) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const token = matches[1].trim()
  const session = sessions.get(token)
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(token)
    return res.status(401).json({ error: 'Session expired' })
  }

  req.auth = session
  req.auth.token = token
  next()
}

const verifyPassword = (user, password) => {
  const hash = createPasswordHash(password, user.salt)
  const expected = Buffer.from(user.passwordHash, 'hex')
  const actual = Buffer.from(hash, 'hex')
  if (expected.length !== actual.length) {
    return false
  }
  return timingSafeEqual(expected, actual)
}

const findUserByUsername = async (username) => {
  const users = await loadUsers()
  const normalized = username.trim().toLowerCase()
  return users.find((user) => user.username.toLowerCase() === normalized)
}

const initPromise = (async () => {
  await ensureDataDir()
  const users = await ensureUsersFile()
  const defaultUser = Array.isArray(users) ? users[0] : null
  await migrateLegacyData(defaultUser ? defaultUser.id : undefined)
})()

const app = express()
const PORT = process.env.PORT ?? 3001

app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '15mb' }))

app.post('/api/login', async (req, res) => {
  await initPromise
  const { username, password } = req.body ?? {}
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Username and password are required.' })
  }

  const normalizedUsername = username.trim()
  if (normalizedUsername.length === 0 || password.length === 0) {
    return res.status(400).json({ error: 'Username and password are required.' })
  }

  try {
    const user = await findUserByUsername(normalizedUsername)
    if (!user || !verifyPassword(user, password)) {
      return res.status(401).json({ error: 'Invalid username or password.' })
    }

    user.updatedAt = new Date().toISOString()
    const users = await loadUsers()
    const index = users.findIndex((candidate) => candidate.id === user.id)
    if (index >= 0) {
      users[index] = user
      await saveUsers(users)
    }

    const token = createSession(user)
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username
      }
    })
  } catch (error) {
    console.error('Failed to authenticate user', error)
    res.status(500).json({ error: 'Unable to sign in right now. Please try again later.' })
  }
})

app.get('/api/data', authenticateRequest, async (req, res) => {
  await initPromise
  try {
    const data = await loadDataForUser(req.auth.userId)
    res.json(data)
  } catch (error) {
    console.error('Failed to load data', error)
    res.status(500).json({ error: 'Failed to load saved data.' })
  }
})

app.put('/api/data', authenticateRequest, async (req, res) => {
  await initPromise
  try {
    const saved = await saveDataForUser(req.auth.userId, req.body ?? {})
    res.json(saved)
  } catch (error) {
    console.error('Failed to save data', error)
    res.status(500).json({ error: 'Failed to save changes.' })
  }
})

app.listen(PORT, () => {
  console.log(`Estate dashboard API listening on port ${PORT}`)
})
