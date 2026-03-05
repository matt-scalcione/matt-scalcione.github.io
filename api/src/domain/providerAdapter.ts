import type { NormalizedEvent, SourceHealth } from "./normalizedEvent";

export interface AdapterCheckpoint {
  cursor: string;
  updatedAt: string; // ISO-8601 UTC timestamp
}

export interface ProviderAdapter {
  sourceName: string;
  connect(fromCheckpoint?: AdapterCheckpoint): AsyncGenerator<NormalizedEvent>;
  health(): Promise<SourceHealth>;
  checkpoint(lastEvent: NormalizedEvent): AdapterCheckpoint;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateNormalizedEvent(event: Partial<NormalizedEvent>): ValidationResult {
  const errors: string[] = [];

  if (!event.eventId) errors.push("eventId is required");
  if (!event.source) errors.push("source is required");
  if (!event.game) errors.push("game is required");
  if (!event.matchId) errors.push("matchId is required");
  if (!event.eventType) errors.push("eventType is required");
  if (!event.occurredAt) errors.push("occurredAt is required");
  if (!event.ingestedAt) errors.push("ingestedAt is required");
  if (!event.payload) errors.push("payload is required");

  return {
    valid: errors.length === 0,
    errors,
  };
}
