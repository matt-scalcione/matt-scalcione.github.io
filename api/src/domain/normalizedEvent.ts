export type GameSlug = "lol" | "dota2";

export type ImportanceTier = "low" | "medium" | "high" | "critical";

export interface EntityRefs {
  teamId?: string;
  playerId?: string;
  tournamentId?: string;
}

export interface NormalizedEvent {
  eventId: string;
  source: string;
  game: GameSlug;
  matchId: string;
  seriesId?: string;
  eventType: string;
  occurredAt: string; // ISO-8601 UTC timestamp
  ingestedAt: string; // ISO-8601 UTC timestamp
  entityRefs?: EntityRefs;
  payload: Record<string, unknown>;
  importance?: ImportanceTier;
  sourceSeq?: string;
}

export interface SourceHealth {
  source: string;
  status: "healthy" | "degraded" | "down";
  measuredAt: string; // ISO-8601 UTC timestamp
  sourceLagMs?: number;
  notes?: string;
}
