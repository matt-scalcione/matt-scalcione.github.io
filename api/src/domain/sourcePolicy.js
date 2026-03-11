const PROVIDER_INFO = {
  riot: {
    label: "Riot",
    sourceType: "official_api",
    official: true,
    experimental: false,
    disabledByDefault: false
  },
  stratz: {
    label: "STRATZ",
    sourceType: "community_api",
    official: false,
    experimental: false,
    disabledByDefault: false
  },
  opendota: {
    label: "OpenDota",
    sourceType: "community_api",
    official: false,
    experimental: false,
    disabledByDefault: false
  },
  steam: {
    label: "Steam Web API",
    sourceType: "official_api",
    official: true,
    experimental: false,
    disabledByDefault: false
  },
  liquipedia: {
    label: "Liquipedia",
    sourceType: "community_scrape",
    official: false,
    experimental: false,
    disabledByDefault: false
  },
  dltv: {
    label: "DLTV",
    sourceType: "unofficial_socket",
    official: false,
    experimental: true,
    disabledByDefault: true
  },
  provider_cache: {
    label: "Provider Cache",
    sourceType: "cache",
    official: false,
    experimental: false,
    disabledByDefault: false
  },
  provider_fallback: {
    label: "Provider Fallback",
    sourceType: "fallback",
    official: false,
    experimental: false,
    disabledByDefault: false
  },
  mock: {
    label: "Mock",
    sourceType: "mock",
    official: false,
    experimental: false,
    disabledByDefault: false
  },
  unknown: {
    label: "Unknown",
    sourceType: "unknown",
    official: false,
    experimental: false,
    disabledByDefault: false
  }
};

const SOURCE_POLICY_MATRIX = {
  lol: {
    live: {
      riot: {
        ownership: "primary",
        priority: 100,
        recommendedRole: "core_live"
      }
    },
    schedule: {
      riot: {
        ownership: "primary",
        priority: 100,
        recommendedRole: "core_schedule"
      }
    },
    results: {
      riot: {
        ownership: "primary",
        priority: 100,
        recommendedRole: "core_results"
      }
    },
    detail: {
      riot: {
        ownership: "primary",
        priority: 100,
        recommendedRole: "core_detail"
      }
    },
    team: {
      riot: {
        ownership: "primary",
        priority: 95,
        recommendedRole: "core_team"
      }
    }
  },
  dota2: {
    live: {
      stratz: {
        ownership: "primary",
        priority: 100,
        recommendedRole: "core_live"
      },
      opendota: {
        ownership: "secondary",
        priority: 85,
        recommendedRole: "live_backup"
      },
      steam: {
        ownership: "secondary",
        priority: 72,
        recommendedRole: "live_sparse_backup"
      },
      liquipedia: {
        ownership: "fallback",
        priority: 40,
        recommendedRole: "schedule_promotions_only"
      },
      dltv: {
        ownership: "experimental",
        priority: 20,
        recommendedRole: "disabled_by_default"
      }
    },
    schedule: {
      liquipedia: {
        ownership: "primary",
        priority: 100,
        recommendedRole: "core_schedule"
      },
      opendota: {
        ownership: "secondary",
        priority: 70,
        recommendedRole: "schedule_crosscheck"
      },
      stratz: {
        ownership: "secondary",
        priority: 65,
        recommendedRole: "schedule_crosscheck"
      },
      steam: {
        ownership: "supplemental",
        priority: 40,
        recommendedRole: "schedule_sparse_crosscheck"
      },
      dltv: {
        ownership: "experimental",
        priority: 10,
        recommendedRole: "disabled_by_default"
      }
    },
    results: {
      opendota: {
        ownership: "primary",
        priority: 100,
        recommendedRole: "core_results"
      },
      stratz: {
        ownership: "secondary",
        priority: 72,
        recommendedRole: "results_crosscheck"
      },
      steam: {
        ownership: "supplemental",
        priority: 35,
        recommendedRole: "results_sparse_crosscheck"
      },
      liquipedia: {
        ownership: "fallback",
        priority: 20,
        recommendedRole: "manual_reference_only"
      },
      dltv: {
        ownership: "experimental",
        priority: 10,
        recommendedRole: "disabled_by_default"
      }
    },
    detail: {
      stratz: {
        ownership: "primary",
        priority: 100,
        recommendedRole: "core_detail"
      },
      opendota: {
        ownership: "secondary",
        priority: 84,
        recommendedRole: "detail_backup"
      },
      steam: {
        ownership: "secondary",
        priority: 60,
        recommendedRole: "detail_sparse_backup"
      },
      liquipedia: {
        ownership: "fallback",
        priority: 35,
        recommendedRole: "context_only"
      },
      dltv: {
        ownership: "experimental",
        priority: 20,
        recommendedRole: "disabled_by_default"
      }
    },
    team: {
      opendota: {
        ownership: "primary",
        priority: 100,
        recommendedRole: "core_team"
      },
      stratz: {
        ownership: "secondary",
        priority: 75,
        recommendedRole: "team_crosscheck"
      },
      liquipedia: {
        ownership: "supplemental",
        priority: 30,
        recommendedRole: "identity_crosscheck"
      }
    }
  }
};

const DELIVERY_PENALTIES = {
  provider_feed: 0,
  provider_cache: -8,
  snapshot_fallback: -18,
  retained_cache: -15,
  synthetic_live: -28,
  provider_fallback: -35,
  mock_data: -90
};

function normalizeToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeGame(value) {
  const token = normalizeToken(value);
  if (!token) return null;
  if (token === "lol" || token.includes("league")) return "lol";
  if (token === "dota2" || token === "dota" || token.includes("dota")) return "dota2";
  return token || null;
}

function normalizeSurface(value) {
  const token = normalizeToken(value);
  if (!token) return null;
  if (token === "live") return "live";
  if (token === "schedule" || token === "upcoming") return "schedule";
  if (token === "results" || token === "completed") return "results";
  if (token === "detail" || token === "match") return "detail";
  if (token === "team" || token === "profile") return "team";
  return token || null;
}

function normalizeProvider(value) {
  const token = normalizeToken(value);
  if (!token) return null;
  if (token.includes("riot") || token.includes("lolesports")) return "riot";
  if (token.includes("stratz")) return "stratz";
  if (token.includes("opendota")) return "opendota";
  if (token.includes("steam")) return "steam";
  if (token.includes("liquipedia")) return "liquipedia";
  if (token.includes("dltv")) return "dltv";
  if (token.includes("mock")) return "mock";
  if (token.includes("provider_cache") || token === "cache") return "provider_cache";
  if (token.includes("provider_fallback") || token.includes("fallback")) return "provider_fallback";
  return null;
}

function inferProviderFromId(entityId) {
  const token = normalizeToken(entityId);
  if (!token) return null;
  if (token.startsWith("lol_riot_") || token.startsWith("lol_")) return "riot";
  if (token.startsWith("dota_stratz_")) return "stratz";
  if (token.includes("_od_")) return "opendota";
  if (token.startsWith("dota_lp_")) return "liquipedia";
  if (token.startsWith("dota_steam_")) return "steam";
  if (token.includes("mock")) return "mock";
  return null;
}

function inferProviderFromEntity(entity) {
  const directCandidates = [
    entity?.source?.provider,
    entity?.source?.primaryProvider,
    entity?.source?.canonicalProvider,
    entity?.source?.telemetryProvider,
    entity?.freshness?.source,
    entity?.source?.page,
    entity?.keySignal
  ];

  for (const candidate of directCandidates) {
    const normalized = normalizeProvider(candidate);
    if (normalized) {
      return normalized;
    }
  }

  const fromId = inferProviderFromId(entity?.id);
  if (fromId) {
    return fromId;
  }

  const normalizedGame = normalizeGame(entity?.game);
  if (normalizedGame === "lol") {
    return "riot";
  }

  if (
    normalizedGame === "dota2" &&
    normalizeToken(entity?.keySignal).includes("schedule")
  ) {
    return "liquipedia";
  }

  return "unknown";
}

export function inferEntitySurface(entity) {
  if (!entity || typeof entity !== "object") {
    return "detail";
  }

  if (
    Array.isArray(entity?.recentMatches) ||
    Array.isArray(entity?.upcomingMatches) ||
    entity?.opponentBreakdown ||
    entity?.headToHead
  ) {
    return "team";
  }

  if (
    entity?.selectedGame ||
    Array.isArray(entity?.seriesGames) ||
    entity?.header ||
    Array.isArray(entity?.liveTicker)
  ) {
    return "detail";
  }

  const status = normalizeToken(entity?.status);
  if (status === "live") return "live";
  if (status === "completed") return "results";
  if (status === "upcoming") return "schedule";
  return "detail";
}

function resolveDelivery(entity) {
  const status = normalizeToken(entity?.status);
  const keySignal = normalizeToken(entity?.keySignal);
  const freshnessSource = normalizeProvider(entity?.freshness?.source);
  const provider = normalizeProvider(entity?.source?.provider);

  if (provider === "mock" || inferProviderFromId(entity?.id) === "mock") {
    return {
      mode: "mock_data",
      derivedFromSurface: null
    };
  }

  if (status === "live" && keySignal.includes("schedule_started")) {
    return {
      mode: "synthetic_live",
      derivedFromSurface: "schedule"
    };
  }

  if (entity?.source?.snapshotGeneratedAt) {
    return {
      mode: "snapshot_fallback",
      derivedFromSurface: null
    };
  }

  if (entity?.retainedFromScheduleCache) {
    return {
      mode: "retained_cache",
      derivedFromSurface: "schedule"
    };
  }

  if (provider === "provider_fallback") {
    return {
      mode: "provider_fallback",
      derivedFromSurface: null
    };
  }

  if (freshnessSource === "provider_cache" || normalizeToken(entity?.freshness?.status) === "stale_cache") {
    return {
      mode: "provider_cache",
      derivedFromSurface: null
    };
  }

  return {
    mode: "provider_feed",
    derivedFromSurface: null
  };
}

function resolvePolicy(game, surface, provider) {
  const normalizedGame = normalizeGame(game);
  const normalizedSurface = normalizeSurface(surface) || "detail";
  const normalizedProvider = normalizeProvider(provider) || "unknown";
  const providerInfo = PROVIDER_INFO[normalizedProvider] || PROVIDER_INFO.unknown;
  const policy =
    SOURCE_POLICY_MATRIX?.[normalizedGame]?.[normalizedSurface]?.[normalizedProvider] || {
      ownership: normalizedProvider === "mock" ? "mock" : normalizedProvider === "unknown" ? "unknown" : "supplemental",
      priority: normalizedProvider === "mock" ? 0 : 50,
      recommendedRole: normalizedProvider === "mock" ? "demo_only" : "supplemental"
    };

  return {
    provider: normalizedProvider,
    providerLabel: providerInfo.label,
    sourceType: providerInfo.sourceType,
    official: providerInfo.official,
    experimental: providerInfo.experimental,
    disabledByDefault: providerInfo.disabledByDefault,
    ownership: policy.ownership,
    priority: policy.priority,
    recommendedRole: policy.recommendedRole,
    game: normalizedGame,
    surface: normalizedSurface
  };
}

function seriesScoreValue(entity) {
  const left = Number(entity?.seriesScore?.left);
  const right = Number(entity?.seriesScore?.right);
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return 0;
  }

  return left + right;
}

function completenessScore(entity) {
  if (!entity || typeof entity !== "object") {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 0;
  if (String(entity?.teams?.left?.name || "").trim()) score += 5;
  if (String(entity?.teams?.right?.name || "").trim()) score += 5;
  if (String(entity?.teams?.left?.id || "").trim()) score += 4;
  if (String(entity?.teams?.right?.id || "").trim()) score += 4;
  if (Number(entity?.bestOf || 0) > 1) score += 2;
  if (seriesScoreValue(entity) > 0) score += 5;
  if (entity?.winnerTeamId) score += 5;
  if (entity?.sourceMatchId) score += 5;
  if (entity?.watchUrl) score += 3;
  if (Array.isArray(entity?.watchOptions) && entity.watchOptions.length > 0) score += 2;
  if (Number(entity?.competitiveTier || 0) > 0) score += 1;
  if (entity?.updatedAt || entity?.freshness?.updatedAt) score += 1;
  return score;
}

function recencyScore(entity) {
  const timestampMs = Date.parse(
    String(entity?.updatedAt || entity?.freshness?.updatedAt || entity?.endAt || entity?.startAt || "")
  );
  return Number.isFinite(timestampMs) ? timestampMs : Number.NEGATIVE_INFINITY;
}

export function resolveEntitySourceContext(entity, { surface } = {}) {
  const resolvedSurface = normalizeSurface(surface) || inferEntitySurface(entity);
  const provider = inferProviderFromEntity(entity);
  const delivery = resolveDelivery(entity);
  const policy = resolvePolicy(entity?.game, resolvedSurface, provider);
  const adjustedPriority =
    policy.priority + (DELIVERY_PENALTIES[delivery.mode] ?? 0);

  return {
    provider: policy.provider,
    providerLabel: policy.providerLabel,
    sourceType:
      delivery.mode === "synthetic_live" ? "derived_schedule" : policy.sourceType,
    official: policy.official,
    experimental: policy.experimental,
    disabledByDefault: policy.disabledByDefault,
    ownership:
      delivery.mode === "synthetic_live" ? "derived" : policy.ownership,
    priority: policy.priority,
    adjustedPriority,
    recommendedRole: policy.recommendedRole,
    surface: resolvedSurface,
    delivery: delivery.mode,
    derivedFromSurface: delivery.derivedFromSurface,
    game: policy.game
  };
}

export function annotateEntitySource(entity, { surface } = {}) {
  if (!entity || typeof entity !== "object") {
    return entity;
  }

  const context = resolveEntitySourceContext(entity, { surface });

  return {
    ...entity,
    source: {
      ...(entity?.source || {}),
      provider: context.provider,
      providerLabel: context.providerLabel,
      provenance: {
        surface: context.surface,
        ownership: context.ownership,
        priority: context.priority,
        adjustedPriority: context.adjustedPriority,
        sourceType: context.sourceType,
        delivery: context.delivery,
        recommendedRole: context.recommendedRole,
        official: context.official,
        experimental: context.experimental,
        disabledByDefault: context.disabledByDefault,
        derivedFromSurface: context.derivedFromSurface
      }
    }
  };
}

export function compareSourcePriority(leftEntity, rightEntity, { surface } = {}) {
  const left = resolveEntitySourceContext(leftEntity, { surface });
  const right = resolveEntitySourceContext(rightEntity, { surface });

  if (left.adjustedPriority !== right.adjustedPriority) {
    return left.adjustedPriority - right.adjustedPriority;
  }

  const leftCompleteness = completenessScore(leftEntity);
  const rightCompleteness = completenessScore(rightEntity);
  if (leftCompleteness !== rightCompleteness) {
    return leftCompleteness - rightCompleteness;
  }

  return recencyScore(leftEntity) - recencyScore(rightEntity);
}

export function preferHigherPriorityEntity(leftEntity, rightEntity, { surface } = {}) {
  if (!leftEntity) return rightEntity || null;
  if (!rightEntity) return leftEntity;
  return compareSourcePriority(leftEntity, rightEntity, { surface }) >= 0
    ? leftEntity
    : rightEntity;
}

export function summarizeSourceUsage(rows = [], { surface } = {}) {
  const summaryByProvider = new Map();
  let snapshotRows = 0;
  let retainedRows = 0;
  let syntheticRows = 0;
  let experimentalRows = 0;

  for (const row of Array.isArray(rows) ? rows : []) {
    const annotated = annotateEntitySource(row, { surface });
    const context = annotated?.source?.provenance || {};
    const provider = String(annotated?.source?.provider || "unknown");

    if (!summaryByProvider.has(provider)) {
      summaryByProvider.set(provider, {
        provider,
        label: annotated?.source?.providerLabel || provider,
        count: 0,
        ownership: context.ownership || "unknown",
        priority: context.priority ?? 0,
        experimental: Boolean(context.experimental),
        official: Boolean(context.official),
        deliveryModes: new Set()
      });
    }

    const target = summaryByProvider.get(provider);
    target.count += 1;
    target.deliveryModes.add(context.delivery || "provider_feed");

    if (row?.source?.snapshotGeneratedAt) snapshotRows += 1;
    if (row?.retainedFromScheduleCache) retainedRows += 1;
    if (context.delivery === "synthetic_live") syntheticRows += 1;
    if (context.experimental) experimentalRows += 1;
  }

  const providers = Array.from(summaryByProvider.values())
    .map((entry) => ({
      ...entry,
      deliveryModes: Array.from(entry.deliveryModes.values()).sort()
    }))
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return right.priority - left.priority;
    });

  return {
    total: Array.isArray(rows) ? rows.length : 0,
    snapshotRows,
    retainedRows,
    syntheticRows,
    experimentalRows,
    providers
  };
}

export function getSourcePolicyCatalog() {
  const catalog = {};

  for (const [game, surfaces] of Object.entries(SOURCE_POLICY_MATRIX)) {
    catalog[game] = {};

    for (const [surface, providers] of Object.entries(surfaces)) {
      catalog[game][surface] = Object.entries(providers)
        .map(([provider, policy]) => {
          const providerInfo = PROVIDER_INFO[provider] || PROVIDER_INFO.unknown;
          return {
            provider,
            providerLabel: providerInfo.label,
            sourceType: providerInfo.sourceType,
            official: providerInfo.official,
            experimental: providerInfo.experimental,
            disabledByDefault: providerInfo.disabledByDefault,
            ownership: policy.ownership,
            priority: policy.priority,
            recommendedRole: policy.recommendedRole
          };
        })
        .sort((left, right) => right.priority - left.priority);
    }
  }

  return catalog;
}
