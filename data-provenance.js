function normalizeToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function providerLabelFromToken(value) {
  const token = normalizeToken(value);
  if (!token) {
    return null;
  }

  if (token.includes("livestats") && token.includes("riot")) {
    return "Riot Live Stats";
  }
  if (token.includes("riot") || token.includes("lolesports")) {
    return "Riot";
  }
  if (token.includes("opendota")) {
    return "OpenDota";
  }
  if (token.includes("liquipedia")) {
    return "Liquipedia";
  }
  if (token.includes("stratz")) {
    return "STRATZ";
  }
  if (token.includes("provider_cache")) {
    return "Cache";
  }
  if (token.includes("provider_fallback")) {
    return "Fallback";
  }
  if (token.includes("mock")) {
    return "Mock";
  }

  return null;
}

function parseTimestamp(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function relativeAgeLabel(value, nowMs = Date.now()) {
  const timestampMs = parseTimestamp(value);
  if (timestampMs === null) {
    return null;
  }

  const ageMs = Math.max(0, nowMs - timestampMs);
  if (ageMs < 90 * 1000) {
    return "just now";
  }

  const ageMinutes = Math.round(ageMs / (60 * 1000));
  if (ageMinutes < 60) {
    return `${ageMinutes}m ago`;
  }

  const ageHours = Math.round(ageMs / (60 * 60 * 1000));
  if (ageHours < 36) {
    return `${ageHours}h ago`;
  }

  const ageDays = Math.round(ageMs / (24 * 60 * 60 * 1000));
  return `${ageDays}d ago`;
}

function absoluteDateTimeLabel(value) {
  const timestampMs = parseTimestamp(value);
  if (timestampMs === null) {
    return value ? String(value) : "";
  }

  return new Date(timestampMs).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function inferProviderLabel(row) {
  const sourceLabel = providerLabelFromToken(row?.source?.provider);
  if (sourceLabel) {
    return sourceLabel;
  }

  const freshnessLabel = providerLabelFromToken(row?.freshness?.source);
  if (freshnessLabel) {
    return freshnessLabel;
  }

  const telemetryLabel = providerLabelFromToken(row?.source?.telemetryProvider);
  if (telemetryLabel) {
    return telemetryLabel;
  }

  const pageLabel = providerLabelFromToken(row?.source?.page);
  if (pageLabel) {
    return pageLabel;
  }

  const rowId = normalizeToken(row?.id);
  if (rowId.includes("_riot_") || normalizeToken(row?.game) === "lol") {
    return "Riot";
  }
  if (rowId.includes("_od_")) {
    return "OpenDota";
  }

  const signal = normalizeToken(row?.keySignal);
  if (signal.includes("stratz")) {
    return "STRATZ";
  }
  if (signal.includes("schedule") && normalizeToken(row?.game) === "dota2") {
    return "Liquipedia";
  }

  if (row?.retainedFromScheduleCache) {
    return "Schedule Cache";
  }

  if (normalizeToken(row?.game) === "dota2") {
    return "Dota Provider";
  }

  return "Provider";
}

export function buildRowDataProvenance(row, { fallbackTimestamp = null } = {}) {
  const snapshotTimestamp = row?.source?.snapshotGeneratedAt || null;
  const liveTimestamp =
    row?.updatedAt || row?.freshness?.updatedAt || row?.endAt || fallbackTimestamp || null;
  const effectiveTimestamp = snapshotTimestamp || liveTimestamp;
  const providerLabel = inferProviderLabel(row);
  const sourceLabel =
    snapshotTimestamp && providerLabel && providerLabel !== "Provider"
      ? `${providerLabel} Snapshot`
      : snapshotTimestamp
        ? "Snapshot"
        : providerLabel;
  const ageLabel = relativeAgeLabel(effectiveTimestamp);
  const detailLabel = snapshotTimestamp
    ? effectiveTimestamp
      ? `Snapshot published ${absoluteDateTimeLabel(effectiveTimestamp)}`
      : "Snapshot fallback active"
    : liveTimestamp
      ? `Updated ${absoluteDateTimeLabel(liveTimestamp)}`
      : sourceLabel;

  return {
    label: sourceLabel,
    ageLabel,
    text: sourceLabel ? (ageLabel ? `${sourceLabel} · ${ageLabel}` : sourceLabel) : "",
    title: sourceLabel && detailLabel ? `${sourceLabel} · ${detailLabel}` : detailLabel || "",
    tone: snapshotTimestamp ? "snapshot" : "provider",
    timestamp: effectiveTimestamp
  };
}
