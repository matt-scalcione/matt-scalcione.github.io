import { createHash, randomUUID } from "node:crypto";

const storeState = {
  initPromise: null,
  prunePromise: null,
  pool: null,
  initializedAt: null,
  lastInitError: null,
  lastPersistAt: null,
  lastPersistError: null,
  lastPersistResults: [],
  lastPruneAt: null,
  lastPruneError: null,
  lastPruneResults: [],
  collectionHashes: new Map(),
  detailHashes: new Map(),
  profileHashes: new Map(),
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
  const pruneEnabled =
    enabled && String(process.env.CANONICAL_STORE_PRUNE_ENABLED || "1").trim() !== "0";
  const retentionDays = Math.max(
    1,
    Number.parseInt(process.env.CANONICAL_STORE_RETENTION_DAYS || "14", 10) || 14
  );
  const pruneIntervalMs = Math.max(
    5 * 60 * 1000,
    Number.parseInt(process.env.CANONICAL_STORE_PRUNE_INTERVAL_MS || String(6 * 60 * 60 * 1000), 10) ||
      6 * 60 * 60 * 1000
  );

  return {
    enabled,
    connectionString,
    schema,
    pruneEnabled,
    retentionDays,
    pruneIntervalMs
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

export function canonicalTeamProfileKey(teamId, options = {}) {
  const normalizedTeamId = String(teamId || "").trim();
  if (!normalizedTeamId) {
    return null;
  }

  const parsedLimit = Number.parseInt(String(options?.limit || 5), 10);

  return createHash("sha256")
    .update(
      JSON.stringify({
        teamId: normalizedTeamId,
        game: normalizeToken(options?.game),
        opponentId: String(options?.opponentId || "").trim(),
        limit: Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : 5,
        seedMatchId: String(options?.seedMatchId || "").trim(),
        teamNameHint: normalizeKey(options?.teamNameHint || "")
      })
    )
    .digest("hex");
}

export function canonicalTeamEntityId(teamId, options = {}) {
  const normalizedTeamId = String(teamId || "").trim();
  const normalizedGame = normalizeToken(options?.game || options?.payload?.game);
  const normalizedName = normalizeKey(
    options?.teamNameHint ||
      options?.payload?.name ||
      options?.payload?.teamName ||
      ""
  );

  if (!normalizedGame && !normalizedTeamId && !normalizedName) {
    return null;
  }

  if (normalizedGame === "dota2") {
    if (/^\d+$/.test(normalizedTeamId)) {
      return `dota2:id:${normalizedTeamId}`;
    }

    if (normalizedName) {
      return `dota2:name:${normalizedName}`;
    }

    return normalizedTeamId ? `dota2:id:${normalizeKey(normalizedTeamId)}` : null;
  }

  if (normalizedGame === "lol") {
    if (normalizedName) {
      return `lol:name:${normalizedName}`;
    }

    return normalizedTeamId ? `lol:id:${normalizeKey(normalizedTeamId)}` : null;
  }

  if (normalizedName) {
    return `${normalizedGame || "unknown"}:name:${normalizedName}`;
  }

  return normalizedTeamId ? `${normalizedGame || "unknown"}:id:${normalizeKey(normalizedTeamId)}` : null;
}

export function canonicalMatchDetailKey(matchId, options = {}) {
  const normalizedMatchId = String(matchId || "").trim();
  if (!normalizedMatchId) {
    return null;
  }

  const parsedGameNumber = Number.parseInt(String(options?.gameNumber || ""), 10);

  return createHash("sha256")
    .update(
      JSON.stringify({
        matchId: normalizedMatchId,
        gameNumber: Number.isInteger(parsedGameNumber) && parsedGameNumber > 0 ? parsedGameNumber : null
      })
    )
    .digest("hex");
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

function entityHash({ entityId, options, payload }) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        entityId: String(entityId || "").trim(),
        options: safeJson(options),
        payload: safeJson(payload)
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
    matchSnapshots: `${namespace}.pulseboard_match_snapshots`,
    matchDetailState: `${namespace}.pulseboard_match_detail_state`,
    matchDetailSnapshots: `${namespace}.pulseboard_match_detail_snapshots`,
    teamProfileState: `${namespace}.pulseboard_team_profile_state`,
    teamProfileSnapshots: `${namespace}.pulseboard_team_profile_snapshots`
  };
}

async function loadPgPool() {
  const pgModule = await import("pg");
  return pgModule.Pool;
}

export function canonicalStoreMigrationStatements(tables) {
  return [
    `
      ALTER TABLE ${tables.teamProfileState}
      ADD COLUMN IF NOT EXISTS canonical_team_id TEXT
    `,
    `
      ALTER TABLE ${tables.teamProfileState}
      ADD COLUMN IF NOT EXISTS normalized_team_name TEXT
    `,
    `
      ALTER TABLE ${tables.teamProfileSnapshots}
      ADD COLUMN IF NOT EXISTS canonical_team_id TEXT
    `,
    `
      ALTER TABLE ${tables.teamProfileSnapshots}
      ADD COLUMN IF NOT EXISTS normalized_team_name TEXT
    `
  ];
}

export function canonicalStoreIndexStatements(tables) {
  return [
    `
      CREATE INDEX IF NOT EXISTS pulseboard_match_state_surface_idx
      ON ${tables.matchState} (surface, game, status, last_seen_at DESC)
    `,
    `
      CREATE INDEX IF NOT EXISTS pulseboard_match_snapshots_match_idx
      ON ${tables.matchSnapshots} (match_id, observed_at DESC)
    `,
    `
      CREATE INDEX IF NOT EXISTS pulseboard_ingest_runs_surface_idx
      ON ${tables.ingestRuns} (surface, observed_at DESC)
    `,
    `
      CREATE INDEX IF NOT EXISTS pulseboard_team_profile_state_team_idx
      ON ${tables.teamProfileState} (team_id, game, last_seen_at DESC)
    `,
    `
      CREATE INDEX IF NOT EXISTS pulseboard_team_profile_state_canonical_idx
      ON ${tables.teamProfileState} (canonical_team_id, game, last_seen_at DESC)
    `,
    `
      CREATE INDEX IF NOT EXISTS pulseboard_team_profile_state_name_idx
      ON ${tables.teamProfileState} (normalized_team_name, game, last_seen_at DESC)
    `,
    `
      CREATE INDEX IF NOT EXISTS pulseboard_match_detail_state_match_idx
      ON ${tables.matchDetailState} (match_id, game_number, last_seen_at DESC)
    `,
    `
      CREATE INDEX IF NOT EXISTS pulseboard_match_detail_snapshots_detail_idx
      ON ${tables.matchDetailSnapshots} (detail_key, observed_at DESC)
    `,
    `
      CREATE INDEX IF NOT EXISTS pulseboard_team_profile_snapshots_profile_idx
      ON ${tables.teamProfileSnapshots} (profile_key, observed_at DESC)
    `
  ];
}

export function canonicalTeamProfileStateUpsertStatement(tables) {
  return `
    INSERT INTO ${tables.teamProfileState} (
      profile_key,
      team_id,
      canonical_team_id,
      normalized_team_name,
      game,
      opponent_id,
      row_updated_at,
      first_seen_at,
      last_seen_at,
      last_ingest_run_id,
      payload
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
    ON CONFLICT (profile_key)
    DO UPDATE SET
      team_id = EXCLUDED.team_id,
      canonical_team_id = EXCLUDED.canonical_team_id,
      normalized_team_name = EXCLUDED.normalized_team_name,
      game = EXCLUDED.game,
      opponent_id = EXCLUDED.opponent_id,
      row_updated_at = EXCLUDED.row_updated_at,
      last_seen_at = EXCLUDED.last_seen_at,
      last_ingest_run_id = EXCLUDED.last_ingest_run_id,
      payload = EXCLUDED.payload
  `;
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
        CREATE TABLE IF NOT EXISTS ${tables.teamProfileState} (
          profile_key TEXT PRIMARY KEY,
          team_id TEXT NOT NULL,
          canonical_team_id TEXT,
          normalized_team_name TEXT,
          game TEXT,
          opponent_id TEXT,
          row_updated_at TIMESTAMPTZ,
          first_seen_at TIMESTAMPTZ NOT NULL,
          last_seen_at TIMESTAMPTZ NOT NULL,
          last_ingest_run_id UUID REFERENCES ${tables.ingestRuns}(ingest_run_id) ON DELETE SET NULL,
          payload JSONB NOT NULL
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ${tables.matchDetailState} (
          detail_key TEXT PRIMARY KEY,
          match_id TEXT NOT NULL,
          game TEXT,
          game_number INTEGER,
          row_updated_at TIMESTAMPTZ,
          first_seen_at TIMESTAMPTZ NOT NULL,
          last_seen_at TIMESTAMPTZ NOT NULL,
          last_ingest_run_id UUID REFERENCES ${tables.ingestRuns}(ingest_run_id) ON DELETE SET NULL,
          payload JSONB NOT NULL
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ${tables.matchDetailSnapshots} (
          snapshot_id UUID PRIMARY KEY,
          ingest_run_id UUID NOT NULL REFERENCES ${tables.ingestRuns}(ingest_run_id) ON DELETE CASCADE,
          detail_key TEXT NOT NULL,
          match_id TEXT NOT NULL,
          game TEXT,
          game_number INTEGER,
          observed_at TIMESTAMPTZ NOT NULL,
          payload JSONB NOT NULL
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ${tables.teamProfileSnapshots} (
          snapshot_id UUID PRIMARY KEY,
          ingest_run_id UUID NOT NULL REFERENCES ${tables.ingestRuns}(ingest_run_id) ON DELETE CASCADE,
          profile_key TEXT NOT NULL,
          team_id TEXT NOT NULL,
          canonical_team_id TEXT,
          normalized_team_name TEXT,
          game TEXT,
          opponent_id TEXT,
          observed_at TIMESTAMPTZ NOT NULL,
          payload JSONB NOT NULL
        )
      `);
      for (const statement of canonicalStoreMigrationStatements(tables)) {
        await pool.query(statement);
      }
      for (const statement of canonicalStoreIndexStatements(tables)) {
        await pool.query(statement);
      }

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
    pruneEnabled: config.pruneEnabled,
    retentionDays: config.retentionDays,
    pruneIntervalMs: config.pruneIntervalMs,
    initializedAt: storeState.initializedAt,
    lastInitError: storeState.lastInitError,
    lastPersistAt: storeState.lastPersistAt,
    lastPersistError: storeState.lastPersistError,
    lastPersistResults: storeState.lastPersistResults.slice(),
    lastPruneAt: storeState.lastPruneAt,
    lastPruneError: storeState.lastPruneError,
    lastPruneResults: storeState.lastPruneResults.slice(),
    trackedCollections: Array.from(storeState.collectionHashes.entries()).map(([key, value]) => ({
      key,
      hash: value.hash,
      persistedAt: value.persistedAt,
      rowCount: value.rowCount
    })),
    trackedDetails: Array.from(storeState.detailHashes.entries()).map(([key, value]) => ({
      key,
      hash: value.hash,
      persistedAt: value.persistedAt
    })),
    trackedProfiles: Array.from(storeState.profileHashes.entries()).map(([key, value]) => ({
      key,
      hash: value.hash,
      persistedAt: value.persistedAt
    }))
  };
}

export async function maybePruneCanonicalStore() {
  const config = canonicalStoreConfig();
  if (!config.enabled) {
    return {
      enabled: false,
      pruned: false,
      skipped: true,
      reason: "disabled"
    };
  }

  if (!config.pruneEnabled) {
    return {
      enabled: true,
      pruned: false,
      skipped: true,
      reason: "prune_disabled"
    };
  }

  const lastPruneMs = Date.parse(String(storeState.lastPruneAt || ""));
  if (Number.isFinite(lastPruneMs) && Date.now() - lastPruneMs < config.pruneIntervalMs) {
    return {
      enabled: true,
      pruned: false,
      skipped: true,
      reason: "interval",
      nextEligibleAt: new Date(lastPruneMs + config.pruneIntervalMs).toISOString()
    };
  }

  if (storeState.prunePromise) {
    return storeState.prunePromise;
  }

  const initialized = await ensureInitialized();
  if (!initialized || !storeState.pool) {
    return {
      enabled: true,
      pruned: false,
      skipped: true,
      reason: "init_failed",
      error: storeState.lastInitError
    };
  }

  const tables = canonicalTables(config.schema);
  const cutoffAt = new Date(Date.now() - config.retentionDays * 24 * 60 * 60 * 1000).toISOString();

  storeState.prunePromise = (async () => {
    const client = await storeState.pool.connect();

    try {
      await client.query("BEGIN");

      const matchSnapshots = await client.query(
        `DELETE FROM ${tables.matchSnapshots} WHERE observed_at < $1`,
        [cutoffAt]
      );
      const matchDetailSnapshots = await client.query(
        `DELETE FROM ${tables.matchDetailSnapshots} WHERE observed_at < $1`,
        [cutoffAt]
      );
      const teamProfileSnapshots = await client.query(
        `DELETE FROM ${tables.teamProfileSnapshots} WHERE observed_at < $1`,
        [cutoffAt]
      );
      const ingestRuns = await client.query(
        `
          DELETE FROM ${tables.ingestRuns} AS runs
          WHERE runs.observed_at < $1
            AND NOT EXISTS (
              SELECT 1
              FROM ${tables.matchState} AS match_state
              WHERE match_state.last_ingest_run_id = runs.ingest_run_id
            )
            AND NOT EXISTS (
              SELECT 1
              FROM ${tables.matchDetailState} AS match_detail_state
              WHERE match_detail_state.last_ingest_run_id = runs.ingest_run_id
            )
            AND NOT EXISTS (
              SELECT 1
              FROM ${tables.teamProfileState} AS team_profile_state
              WHERE team_profile_state.last_ingest_run_id = runs.ingest_run_id
            )
        `,
        [cutoffAt]
      );

      await client.query("COMMIT");

      const observedAt = new Date().toISOString();
      const result = {
        enabled: true,
        pruned: true,
        skipped: false,
        observedAt,
        cutoffAt,
        retentionDays: config.retentionDays,
        deleted: {
          matchSnapshots: matchSnapshots.rowCount || 0,
          matchDetailSnapshots: matchDetailSnapshots.rowCount || 0,
          teamProfileSnapshots: teamProfileSnapshots.rowCount || 0,
          ingestRuns: ingestRuns.rowCount || 0
        }
      };

      storeState.lastPruneAt = observedAt;
      storeState.lastPruneError = null;
      storeState.lastPruneResults = [result, ...storeState.lastPruneResults].slice(0, 12);

      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      storeState.lastPruneError = error?.message || String(error);
      return {
        enabled: true,
        pruned: false,
        skipped: true,
        reason: "prune_failed",
        error: storeState.lastPruneError
      };
    } finally {
      client.release();
      storeState.prunePromise = null;
    }
  })();

  return storeState.prunePromise;
}

export async function loadCanonicalMatchCollection({
  surface,
  game = null
} = {}) {
  const config = canonicalStoreConfig();
  const normalizedSurface = normalizeToken(surface) || "unknown";
  const normalizedGame = normalizeToken(game) || null;

  if (!config.enabled) {
    return [];
  }

  const initialized = await ensureInitialized();
  if (!initialized || !storeState.pool) {
    return [];
  }

  const tables = canonicalTables(config.schema);

  try {
    const result = await storeState.pool.query(
      `
        SELECT payload, last_seen_at, row_updated_at, surface
        FROM ${tables.matchState}
        WHERE surface = $1
          AND ($2::text IS NULL OR game = $2)
        ORDER BY
          COALESCE(start_at, end_at, row_updated_at, last_seen_at) DESC,
          match_id ASC
      `,
      [normalizedSurface, normalizedGame]
    );

    return result.rows
      .map((row) => {
        const payload = safeJson(row?.payload);
        if (!payload || typeof payload !== "object") {
          return null;
        }

        return {
          ...payload,
          source: {
            ...(payload?.source || {}),
            canonicalFallback: true,
            canonicalObservedAt: toIsoTimestamp(row?.last_seen_at, null),
            canonicalSurface: normalizedSurface
          },
          freshness: {
            ...(payload?.freshness || {}),
            source: payload?.freshness?.source || payload?.source?.provider || "canonical_store",
            status: payload?.freshness?.status || "stale_cache",
            updatedAt:
              payload?.freshness?.updatedAt ||
              toIsoTimestamp(row?.row_updated_at, null) ||
              toIsoTimestamp(row?.last_seen_at, null)
          }
        };
      })
      .filter(Boolean);
  } catch (error) {
    storeState.lastPersistError = error?.message || String(error);
    return [];
  }
}

export async function loadCanonicalTeamProfile({
  teamId,
  options = {}
} = {}) {
  const config = canonicalStoreConfig();
  const normalizedTeamId = String(teamId || "").trim();
  const profileKey = canonicalTeamProfileKey(normalizedTeamId, options);
  const canonicalTeamId = canonicalTeamEntityId(normalizedTeamId, options);
  const normalizedTeamName = normalizeKey(options?.teamNameHint || "");
  const normalizedGame = normalizeToken(options?.game);
  const normalizedOpponentId = String(options?.opponentId || "").trim() || null;

  if (!config.enabled || !profileKey) {
    return null;
  }

  const initialized = await ensureInitialized();
  if (!initialized || !storeState.pool) {
    return null;
  }

  const tables = canonicalTables(config.schema);

  try {
    let result = await storeState.pool.query(
      `
        SELECT payload, last_seen_at, row_updated_at
        FROM ${tables.teamProfileState}
        WHERE profile_key = $1
        LIMIT 1
      `,
      [profileKey]
    );
    let row = result.rows[0];
    if (!row && (canonicalTeamId || normalizedTeamName)) {
      result = await storeState.pool.query(
        `
          SELECT payload, last_seen_at, row_updated_at
          FROM ${tables.teamProfileState}
          WHERE ($1::text IS NULL OR game = $1)
            AND (
              ($2::text IS NOT NULL AND canonical_team_id = $2)
              OR ($3::text IS NOT NULL AND normalized_team_name = $3)
            )
          ORDER BY
            CASE WHEN $4::text IS NOT NULL AND opponent_id = $4 THEN 0 ELSE 1 END,
            last_seen_at DESC
          LIMIT 1
        `,
        [
          normalizedGame || null,
          canonicalTeamId || null,
          normalizedTeamName || null,
          normalizedOpponentId
        ]
      );
      row = result.rows[0];
    }
    const payload = safeJson(row?.payload);

    if (!payload || typeof payload !== "object") {
      return null;
    }

    return {
      ...payload,
      source: {
        ...(payload?.source || {}),
        canonicalFallback: true,
        canonicalObservedAt: toIsoTimestamp(row?.last_seen_at, null),
        canonicalSurface: "team_profile"
      },
      freshness: {
        ...(payload?.freshness || {}),
        source: payload?.freshness?.source || payload?.source?.provider || "canonical_store",
        status: payload?.freshness?.status || "stale_cache",
        updatedAt:
          payload?.freshness?.updatedAt ||
          toIsoTimestamp(row?.row_updated_at, null) ||
          toIsoTimestamp(row?.last_seen_at, null)
      }
    };
  } catch (error) {
    storeState.lastPersistError = error?.message || String(error);
    return null;
  }
}

export async function loadCanonicalMatchDetail({
  matchId,
  options = {}
} = {}) {
  const config = canonicalStoreConfig();
  const normalizedMatchId = String(matchId || "").trim();
  const detailKey = canonicalMatchDetailKey(normalizedMatchId, options);

  if (!config.enabled || !detailKey) {
    return null;
  }

  const initialized = await ensureInitialized();
  if (!initialized || !storeState.pool) {
    return null;
  }

  const tables = canonicalTables(config.schema);

  try {
    const result = await storeState.pool.query(
      `
        SELECT payload, last_seen_at, row_updated_at
        FROM ${tables.matchDetailState}
        WHERE detail_key = $1
        LIMIT 1
      `,
      [detailKey]
    );
    const row = result.rows[0];
    const payload = safeJson(row?.payload);

    if (!payload || typeof payload !== "object") {
      return null;
    }

    return {
      ...payload,
      source: {
        ...(payload?.source || {}),
        canonicalFallback: true,
        canonicalObservedAt: toIsoTimestamp(row?.last_seen_at, null),
        canonicalSurface: "match_detail"
      },
      freshness: {
        ...(payload?.freshness || {}),
        source: payload?.freshness?.source || payload?.source?.provider || "canonical_store",
        status: payload?.freshness?.status || "stale_cache",
        updatedAt:
          payload?.freshness?.updatedAt ||
          toIsoTimestamp(row?.row_updated_at, null) ||
          toIsoTimestamp(row?.last_seen_at, null)
      }
    };
  } catch (error) {
    storeState.lastPersistError = error?.message || String(error);
    return null;
  }
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
    await maybePruneCanonicalStore();
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
    await maybePruneCanonicalStore();

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

export async function persistCanonicalTeamProfile({
  teamId,
  options = {},
  profile = null
} = {}) {
  const config = canonicalStoreConfig();
  const normalizedTeamId = String(teamId || "").trim();
  const payload = safeJson(profile);
  const profileKey = canonicalTeamProfileKey(normalizedTeamId, options);

  if (!config.enabled) {
    return {
      enabled: false,
      persisted: false,
      skipped: true,
      reason: "disabled",
      surface: "team_profile",
      rowCount: payload ? 1 : 0
    };
  }

  if (!normalizedTeamId || !profileKey || !payload || typeof payload !== "object") {
    return {
      enabled: true,
      persisted: false,
      skipped: true,
      reason: "invalid_profile",
      surface: "team_profile",
      rowCount: 0
    };
  }

  const hash = entityHash({
    entityId: normalizedTeamId,
    options,
    payload
  });
  const previous = storeState.profileHashes.get(profileKey);

  if (previous?.hash === hash) {
    await maybePruneCanonicalStore();
    return {
      enabled: true,
      persisted: false,
      skipped: true,
      reason: "unchanged",
      surface: "team_profile",
      scope: profileKey,
      rowCount: 1
    };
  }

  const initialized = await ensureInitialized();
  if (!initialized || !storeState.pool) {
    return {
      enabled: true,
      persisted: false,
      skipped: true,
      reason: "init_failed",
      surface: "team_profile",
      rowCount: 1,
      error: storeState.lastInitError
    };
  }

  const tables = canonicalTables(config.schema);
  const observedAt = new Date().toISOString();
  const ingestRunId = randomUUID();
  const client = await storeState.pool.connect();
  const normalizedGame = normalizeToken(options?.game || payload?.game) || null;
  const normalizedOpponentId =
    String(options?.opponentId || payload?.headToHead?.opponentId || "").trim() || null;
  const canonicalTeamId = canonicalTeamEntityId(normalizedTeamId, {
    game: normalizedGame,
    teamNameHint: options?.teamNameHint || payload?.name,
    payload
  });
  const normalizedTeamName = normalizeKey(options?.teamNameHint || payload?.name || "");
  const rowUpdatedAt = toIsoTimestamp(payload?.generatedAt || payload?.freshness?.updatedAt, observedAt);

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
        "team_profile",
        profileKey,
        1,
        hash,
        JSON.stringify(
          safeJson({
            game: normalizedGame,
            provider: payload?.source?.provider || null
          })
        ),
        JSON.stringify(
          safeJson({
            teamId: normalizedTeamId,
            opponentId: normalizedOpponentId,
            limit: Number.parseInt(String(options?.limit || 5), 10) || 5,
            seedMatchId: String(options?.seedMatchId || "").trim() || null,
            teamNameHint: String(options?.teamNameHint || "").trim() || null
          })
        ),
        observedAt
      ]
    );
    await client.query(
      `
        INSERT INTO ${tables.teamProfileSnapshots} (
          snapshot_id,
          ingest_run_id,
          profile_key,
          team_id,
          canonical_team_id,
          normalized_team_name,
          game,
          opponent_id,
          observed_at,
          payload
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
      `,
      [
        randomUUID(),
        ingestRunId,
        profileKey,
        normalizedTeamId,
        canonicalTeamId,
        normalizedTeamName || null,
        normalizedGame,
        normalizedOpponentId,
        observedAt,
        JSON.stringify(payload)
      ]
    );
    await client.query(
      canonicalTeamProfileStateUpsertStatement(tables),
      [
        profileKey,
        normalizedTeamId,
        canonicalTeamId,
        normalizedTeamName || null,
        normalizedGame,
        normalizedOpponentId,
        rowUpdatedAt,
        observedAt,
        observedAt,
        ingestRunId,
        JSON.stringify(payload)
      ]
    );

    await client.query("COMMIT");

    const result = {
      enabled: true,
      persisted: true,
      skipped: false,
      surface: "team_profile",
      scope: profileKey,
      rowCount: 1,
      hash,
      observedAt
    };

    storeState.profileHashes.set(profileKey, {
      hash,
      persistedAt: observedAt
    });
    storeState.lastPersistAt = observedAt;
    storeState.lastPersistError = null;
    storeState.lastPersistResults = [
      result,
      ...storeState.lastPersistResults.filter(
        (entry) => entry.surface !== "team_profile" || entry.scope !== profileKey
      )
    ].slice(0, 12);
    await maybePruneCanonicalStore();

    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    storeState.lastPersistError = error?.message || String(error);
    return {
      enabled: true,
      persisted: false,
      skipped: true,
      reason: "persist_failed",
      surface: "team_profile",
      scope: profileKey,
      rowCount: 1,
      error: storeState.lastPersistError
    };
  } finally {
    client.release();
  }
}

export async function persistCanonicalMatchDetail({
  matchId,
  options = {},
  detail = null
} = {}) {
  const config = canonicalStoreConfig();
  const normalizedMatchId = String(matchId || "").trim();
  const payload = safeJson(detail);
  const detailKey = canonicalMatchDetailKey(normalizedMatchId, options);

  if (!config.enabled) {
    return {
      enabled: false,
      persisted: false,
      skipped: true,
      reason: "disabled",
      surface: "match_detail",
      rowCount: payload ? 1 : 0
    };
  }

  if (!normalizedMatchId || !detailKey || !payload || typeof payload !== "object") {
    return {
      enabled: true,
      persisted: false,
      skipped: true,
      reason: "invalid_detail",
      surface: "match_detail",
      rowCount: 0
    };
  }

  const hash = entityHash({
    entityId: normalizedMatchId,
    options,
    payload
  });
  const previous = storeState.detailHashes.get(detailKey);

  if (previous?.hash === hash) {
    await maybePruneCanonicalStore();
    return {
      enabled: true,
      persisted: false,
      skipped: true,
      reason: "unchanged",
      surface: "match_detail",
      scope: detailKey,
      rowCount: 1
    };
  }

  const initialized = await ensureInitialized();
  if (!initialized || !storeState.pool) {
    return {
      enabled: true,
      persisted: false,
      skipped: true,
      reason: "init_failed",
      surface: "match_detail",
      rowCount: 1,
      error: storeState.lastInitError
    };
  }

  const tables = canonicalTables(config.schema);
  const observedAt = new Date().toISOString();
  const ingestRunId = randomUUID();
  const client = await storeState.pool.connect();
  const normalizedGame = normalizeToken(payload?.game) || null;
  const parsedGameNumber = Number.parseInt(
    String(options?.gameNumber || payload?.selectedGame?.number || ""),
    10
  );
  const gameNumber = Number.isInteger(parsedGameNumber) && parsedGameNumber > 0 ? parsedGameNumber : null;
  const rowUpdatedAt = toIsoTimestamp(payload?.updatedAt || payload?.freshness?.updatedAt, observedAt);

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
        "match_detail",
        detailKey,
        1,
        hash,
        JSON.stringify(
          safeJson({
            game: normalizedGame,
            provider: payload?.source?.provider || null
          })
        ),
        JSON.stringify(
          safeJson({
            matchId: normalizedMatchId,
            gameNumber
          })
        ),
        observedAt
      ]
    );
    await client.query(
      `
        INSERT INTO ${tables.matchDetailSnapshots} (
          snapshot_id,
          ingest_run_id,
          detail_key,
          match_id,
          game,
          game_number,
          observed_at,
          payload
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      `,
      [
        randomUUID(),
        ingestRunId,
        detailKey,
        normalizedMatchId,
        normalizedGame,
        gameNumber,
        observedAt,
        JSON.stringify(payload)
      ]
    );
    await client.query(
      `
        INSERT INTO ${tables.matchDetailState} (
          detail_key,
          match_id,
          game,
          game_number,
          row_updated_at,
          first_seen_at,
          last_seen_at,
          last_ingest_run_id,
          payload
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
        ON CONFLICT (detail_key)
        DO UPDATE SET
          match_id = EXCLUDED.match_id,
          game = EXCLUDED.game,
          game_number = EXCLUDED.game_number,
          row_updated_at = EXCLUDED.row_updated_at,
          last_seen_at = EXCLUDED.last_seen_at,
          last_ingest_run_id = EXCLUDED.last_ingest_run_id,
          payload = EXCLUDED.payload
      `,
      [
        detailKey,
        normalizedMatchId,
        normalizedGame,
        gameNumber,
        rowUpdatedAt,
        observedAt,
        observedAt,
        ingestRunId,
        JSON.stringify(payload)
      ]
    );

    await client.query("COMMIT");

    const result = {
      enabled: true,
      persisted: true,
      skipped: false,
      surface: "match_detail",
      scope: detailKey,
      rowCount: 1,
      hash,
      observedAt
    };

    storeState.detailHashes.set(detailKey, {
      hash,
      persistedAt: observedAt
    });
    storeState.lastPersistAt = observedAt;
    storeState.lastPersistError = null;
    storeState.lastPersistResults = [
      result,
      ...storeState.lastPersistResults.filter(
        (entry) => entry.surface !== "match_detail" || entry.scope !== detailKey
      )
    ].slice(0, 12);
    await maybePruneCanonicalStore();

    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    storeState.lastPersistError = error?.message || String(error);
    return {
      enabled: true,
      persisted: false,
      skipped: true,
      reason: "persist_failed",
      surface: "match_detail",
      scope: detailKey,
      rowCount: 1,
      error: storeState.lastPersistError
    };
  } finally {
    client.release();
  }
}
