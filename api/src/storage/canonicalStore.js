import { createHash, randomUUID } from "node:crypto";

const storeState = {
  initPromise: null,
  pool: null,
  initializedAt: null,
  lastInitError: null,
  lastPersistAt: null,
  lastPersistError: null,
  lastPersistResults: [],
  collectionHashes: new Map(),
  activeConnectionString: null,
  activeSchema: null
};

function normalizeToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeKey(value) {
  return normalizeToken(value).replace(/[^a-z0-9]+/g, "");
}

function normalizeIdentifier(value, fallback = "public") {
  const normalized = normalizeToken(value).replace(/[^a-z0-9_]+/g, "_");
  if (!/^[a-z_][a-z0-9_]*$/.test(normalized)) {
    return fallback;
  }

  return normalized;
}

function quoteIdentifier(value) {
  return `"${String(value || "").replace(/"/g, "\"\"")}"`;
}

function collectionKey(surface, scope = "all") {
  return `${normalizeToken(surface) || "unknown"}::${normalizeToken(scope) || "all"}`;
}

function canonicalStoreConfig() {
  const connectionString = String(
    process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_CONNECTION_STRING || ""
  ).trim();
  const schema = normalizeIdentifier(process.env.CANONICAL_STORE_SCHEMA || "pulseboard", "pulseboard");
  const enabledFlag = String(process.env.CANONICAL_STORE_ENABLED || "").trim();
  const enabled =
    enabledFlag === "0"
      ? false
      : enabledFlag === "1"
        ? Boolean(connectionString)
        : Boolean(connectionString);

  return {
    enabled,
    connectionString,
    schema
  };
}

function toIsoTimestamp(value, fallback = null) {
  const parsedMs = Date.parse(String(value || ""));
  if (!Number.isFinite(parsedMs)) {
    return fallback;
  }

  return new Date(parsedMs).toISOString();
}

function safeJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export function canonicalStorageMatchId(row) {
  const externalMatchId = String(row?.id || "").trim();
  if (!externalMatchId) {
    return null;
  }

  if (normalizeToken(row?.game) !== "dota2") {
    return externalMatchId;
  }

  const teams = [
    normalizeKey(row?.teams?.left?.name),
    normalizeKey(row?.teams?.right?.name)
  ]
    .filter(Boolean)
    .sort();
  const tournament = normalizeKey(row?.tournament);
  const startAt = toIsoTimestamp(row?.startAt);
  const startBucket = startAt
    ? startAt
        .slice(0, 13)
        .replace(/[^0-9]/g, "")
    : "na";

  if (teams.length === 2 && tournament) {
    return `dota_series_${tournament}_${teams[0]}_${teams[1]}_${startBucket}`;
  }

  return externalMatchId;
}

function collectionHash({ surface, rows, sourceSummary, metadata }) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        surface,
        rows: Array.isArray(rows) ? rows : [],
        sourceSummary: sourceSummary || null,
        metadata: metadata || null
      })
    )
    .digest("hex");
}

function canonicalTables(schema) {
  const namespace = quoteIdentifier(schema);
  return {
    schema: namespace,
    ingestRuns: `${namespace}.pulseboard_ingest_runs`,
    matchState: `${namespace}.pulseboard_match_state`,
    matchSnapshots: `${namespace}.pulseboard_match_snapshots`
  };
}

async function loadPgPool() {
  const pgModule = await import("pg");
  return pgModule.Pool;
}

async function ensureInitialized() {
  const config = canonicalStoreConfig();
  if (!config.enabled) {
    return false;
  }

  if (
    storeState.pool &&
    storeState.activeConnectionString === config.connectionString &&
    storeState.activeSchema === config.schema
  ) {
    return true;
  }

  if (storeState.initPromise) {
    return storeState.initPromise;
  }

  storeState.initPromise = (async () => {
    try {
      const Pool = await loadPgPool();
      const pool = new Pool({
        connectionString: config.connectionString,
        max: Number.parseInt(process.env.CANONICAL_STORE_POOL_MAX || "4", 10)
      });
      const tables = canonicalTables(config.schema);

      await pool.query(`CREATE SCHEMA IF NOT EXISTS ${tables.schema}`);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ${tables.ingestRuns} (
          ingest_run_id UUID PRIMARY KEY,
          surface TEXT NOT NULL,
          scope TEXT NOT NULL DEFAULT 'all',
          row_count INTEGER NOT NULL DEFAULT 0,
          collection_hash TEXT NOT NULL,
          source_summary JSONB,
          metadata JSONB,
          observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ${tables.matchState} (
          match_id TEXT PRIMARY KEY,
          external_match_id TEXT NOT NULL,
          game TEXT NOT NULL,
          surface TEXT NOT NULL,
          status TEXT NOT NULL,
          provider TEXT,
          provider_priority INTEGER,
          start_at TIMESTAMPTZ,
          end_at TIMESTAMPTZ,
          row_updated_at TIMESTAMPTZ,
          first_seen_at TIMESTAMPTZ NOT NULL,
          last_seen_at TIMESTAMPTZ NOT NULL,
          last_ingest_run_id UUID REFERENCES ${tables.ingestRuns}(ingest_run_id) ON DELETE SET NULL,
          payload JSONB NOT NULL
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ${tables.matchSnapshots} (
          snapshot_id UUID PRIMARY KEY,
          ingest_run_id UUID NOT NULL REFERENCES ${tables.ingestRuns}(ingest_run_id) ON DELETE CASCADE,
          match_id TEXT NOT NULL,
          external_match_id TEXT NOT NULL,
          game TEXT NOT NULL,
          surface TEXT NOT NULL,
          status TEXT NOT NULL,
          provider TEXT,
          provider_priority INTEGER,
          observed_at TIMESTAMPTZ NOT NULL,
          payload JSONB NOT NULL
        )
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS pulseboard_match_state_surface_idx
        ON ${tables.matchState} (surface, game, status, last_seen_at DESC)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS pulseboard_match_snapshots_match_idx
        ON ${tables.matchSnapshots} (match_id, observed_at DESC)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS pulseboard_ingest_runs_surface_idx
        ON ${tables.ingestRuns} (surface, observed_at DESC)
      `);

      if (storeState.pool && storeState.pool !== pool) {
        await storeState.pool.end().catch(() => {});
      }

      storeState.pool = pool;
      storeState.activeConnectionString = config.connectionString;
      storeState.activeSchema = config.schema;
      storeState.initializedAt = new Date().toISOString();
      storeState.lastInitError = null;
      return true;
    } catch (error) {
      storeState.lastInitError = error?.message || String(error);
      storeState.pool = null;
      storeState.activeConnectionString = null;
      storeState.activeSchema = null;
      return false;
    } finally {
      storeState.initPromise = null;
    }
  })();

  return storeState.initPromise;
}

export function getCanonicalStoreDiagnostics() {
  const config = canonicalStoreConfig();

  return {
    enabled: config.enabled,
    backend: config.enabled ? "postgres" : "disabled",
    schema: config.schema,
    databaseConfigured: Boolean(config.connectionString),
    initializedAt: storeState.initializedAt,
    lastInitError: storeState.lastInitError,
    lastPersistAt: storeState.lastPersistAt,
    lastPersistError: storeState.lastPersistError,
    lastPersistResults: storeState.lastPersistResults.slice(),
    trackedCollections: Array.from(storeState.collectionHashes.entries()).map(([key, value]) => ({
      key,
      hash: value.hash,
      persistedAt: value.persistedAt,
      rowCount: value.rowCount
    }))
  };
}

export async function persistCanonicalMatchCollection({
  surface,
  rows = [],
  sourceSummary = null,
  metadata = {},
  scope = "all"
} = {}) {
  const config = canonicalStoreConfig();
  const normalizedSurface = normalizeToken(surface) || "unknown";
  const normalizedScope = normalizeToken(scope) || "all";
  const normalizedRows = Array.isArray(rows) ? rows : [];
  const hash = collectionHash({
    surface: normalizedSurface,
    rows: normalizedRows,
    sourceSummary,
    metadata
  });
  const key = collectionKey(normalizedSurface, normalizedScope);
  const previous = storeState.collectionHashes.get(key);

  if (!config.enabled) {
    return {
      enabled: false,
      persisted: false,
      skipped: true,
      reason: "disabled",
      surface: normalizedSurface,
      rowCount: normalizedRows.length
    };
  }

  if (previous?.hash === hash) {
    return {
      enabled: true,
      persisted: false,
      skipped: true,
      reason: "unchanged",
      surface: normalizedSurface,
      rowCount: normalizedRows.length
    };
  }

  const initialized = await ensureInitialized();
  if (!initialized || !storeState.pool) {
    return {
      enabled: true,
      persisted: false,
      skipped: true,
      reason: "init_failed",
      surface: normalizedSurface,
      rowCount: normalizedRows.length,
      error: storeState.lastInitError
    };
  }

  const tables = canonicalTables(config.schema);
  const observedAt = new Date().toISOString();
  const ingestRunId = randomUUID();
  const client = await storeState.pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      `
        INSERT INTO ${tables.ingestRuns} (
          ingest_run_id,
          surface,
          scope,
          row_count,
          collection_hash,
          source_summary,
          metadata,
          observed_at
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)
      `,
      [
        ingestRunId,
        normalizedSurface,
        normalizedScope,
        normalizedRows.length,
        hash,
        JSON.stringify(safeJson(sourceSummary)),
        JSON.stringify(safeJson(metadata)),
        observedAt
      ]
    );

    for (const row of normalizedRows) {
      const externalMatchId = String(row?.id || "").trim();
      const matchId = canonicalStorageMatchId(row);
      const game = String(row?.game || "").trim();
      const status = String(row?.status || "").trim();

      if (!matchId || !externalMatchId || !game || !status) {
        continue;
      }

      const provider = String(row?.source?.provider || "").trim() || null;
      const providerPriority = Number.isFinite(Number(row?.source?.provenance?.adjustedPriority))
        ? Math.round(Number(row.source.provenance.adjustedPriority))
        : Number.isFinite(Number(row?.source?.provenance?.priority))
          ? Math.round(Number(row.source.provenance.priority))
          : null;
      const startAt = toIsoTimestamp(row?.startAt);
      const endAt = toIsoTimestamp(row?.endAt);
      const rowUpdatedAt = toIsoTimestamp(row?.updatedAt || row?.freshness?.updatedAt);
      const payload = safeJson(row);

      await client.query(
        `
          INSERT INTO ${tables.matchSnapshots} (
            snapshot_id,
            ingest_run_id,
            match_id,
            external_match_id,
            game,
            surface,
            status,
            provider,
            provider_priority,
            observed_at,
            payload
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
        `,
        [
          randomUUID(),
          ingestRunId,
          matchId,
          externalMatchId,
          game,
          normalizedSurface,
          status,
          provider,
          providerPriority,
          observedAt,
          JSON.stringify(payload)
        ]
      );

      await client.query(
        `
          INSERT INTO ${tables.matchState} (
            match_id,
            external_match_id,
            game,
            surface,
            status,
            provider,
            provider_priority,
            start_at,
            end_at,
            row_updated_at,
            first_seen_at,
            last_seen_at,
            last_ingest_run_id,
            payload
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
          ON CONFLICT (match_id)
          DO UPDATE SET
            external_match_id = EXCLUDED.external_match_id,
            game = EXCLUDED.game,
            surface = EXCLUDED.surface,
            status = EXCLUDED.status,
            provider = EXCLUDED.provider,
            provider_priority = EXCLUDED.provider_priority,
            start_at = EXCLUDED.start_at,
            end_at = EXCLUDED.end_at,
            row_updated_at = EXCLUDED.row_updated_at,
            last_seen_at = EXCLUDED.last_seen_at,
            last_ingest_run_id = EXCLUDED.last_ingest_run_id,
            payload = EXCLUDED.payload
        `,
        [
          matchId,
          externalMatchId,
          game,
          normalizedSurface,
          status,
          provider,
          providerPriority,
          startAt,
          endAt,
          rowUpdatedAt,
          observedAt,
          observedAt,
          ingestRunId,
          JSON.stringify(payload)
        ]
      );
    }

    await client.query("COMMIT");

    const result = {
      enabled: true,
      persisted: true,
      skipped: false,
      surface: normalizedSurface,
      scope: normalizedScope,
      rowCount: normalizedRows.length,
      hash,
      observedAt
    };

    storeState.collectionHashes.set(key, {
      hash,
      persistedAt: observedAt,
      rowCount: normalizedRows.length
    });
    storeState.lastPersistAt = observedAt;
    storeState.lastPersistError = null;
    storeState.lastPersistResults = [
      result,
      ...storeState.lastPersistResults.filter((entry) => entry.surface !== normalizedSurface || entry.scope !== normalizedScope)
    ].slice(0, 12);

    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    storeState.lastPersistError = error?.message || String(error);
    return {
      enabled: true,
      persisted: false,
      skipped: true,
      reason: "persist_failed",
      surface: normalizedSurface,
      scope: normalizedScope,
      rowCount: normalizedRows.length,
      error: storeState.lastPersistError
    };
  } finally {
    client.release();
  }
}
