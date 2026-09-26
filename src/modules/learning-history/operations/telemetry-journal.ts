import { parseOperationalTelemetry, type OperationalTelemetry } from "./telemetry";

export const OPERATIONAL_TELEMETRY_RETENTION_MS = 90 * 24 * 60 * 60 * 1_000;
export const MAX_OPERATIONAL_TELEMETRY_RECORDS = 1_000;
export const OPERATIONAL_TELEMETRY_STORAGE_KEY = "engineer-learning-os:operational-telemetry:v1";

export type OperationalTelemetryStorage = Readonly<{
  read(): string | null;
  write(value: string): void;
  remove(): void;
}>;

export type OperationalHistorySnapshot = Readonly<{
  hydrated: boolean;
  persistence: "PERSISTED" | "UNAVAILABLE";
  records: readonly OperationalTelemetry[];
}>;

const INITIAL: OperationalHistorySnapshot = Object.freeze({ hydrated: false, persistence: "UNAVAILABLE", records: Object.freeze([]) });

function retained(records: readonly OperationalTelemetry[], now: number): OperationalTelemetry[] {
  const cutoff = now - OPERATIONAL_TELEMETRY_RETENTION_MS;
  const byCorrelation = new Map<string, OperationalTelemetry>();
  for (const record of records) {
    if (record.timestamp >= cutoff && record.timestamp <= now) byCorrelation.set(record.correlationId, record);
  }
  return [...byCorrelation.values()]
    .sort((left, right) => left.timestamp - right.timestamp || left.correlationId.localeCompare(right.correlationId))
    .slice(-MAX_OPERATIONAL_TELEMETRY_RECORDS);
}

export function parseOperationalHistory(value: string | null, now: number): OperationalTelemetry[] {
  if (!value) return [];
  let input: unknown;
  try { input = JSON.parse(value); } catch { return []; }
  if (!Array.isArray(input)) return [];
  const valid: OperationalTelemetry[] = [];
  for (const candidate of input) {
    try { valid.push(parseOperationalTelemetry(candidate)); } catch { /* Unknown fields and malformed entries fail closed. */ }
  }
  return retained(valid, now);
}

export class LocalOperationalTelemetryJournal {
  private readonly storage: OperationalTelemetryStorage;
  private snapshot: OperationalHistorySnapshot = INITIAL;
  private readonly listeners = new Set<() => void>();

  constructor(storage: OperationalTelemetryStorage) { this.storage = storage; }

  getSnapshot = (): OperationalHistorySnapshot => this.snapshot;
  getServerSnapshot = (): OperationalHistorySnapshot => INITIAL;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  hydrate(now = Date.now()): OperationalHistorySnapshot {
    try {
      const records = parseOperationalHistory(this.storage.read(), now);
      this.storage.write(JSON.stringify(records));
      this.replace({ hydrated: true, persistence: "PERSISTED", records: Object.freeze(records) });
    } catch {
      const records = retained(this.snapshot.records, now);
      this.replace({ hydrated: true, persistence: "UNAVAILABLE", records: Object.freeze(records) });
    }
    return this.snapshot;
  }

  record(value: unknown, now = Date.now()): OperationalHistorySnapshot {
    const entry = parseOperationalTelemetry(value);
    const current = this.snapshot.hydrated ? [...this.snapshot.records] : parseOperationalHistory(this.safeRead(), now);
    const records = retained([...current, entry], now);
    return this.persist(records);
  }

  prune(now = Date.now()): OperationalHistorySnapshot {
    const current = this.snapshot.hydrated ? this.snapshot.records : parseOperationalHistory(this.safeRead(), now);
    return this.persist(retained(current, now));
  }

  clear(): OperationalHistorySnapshot {
    try {
      this.storage.remove();
      this.replace({ hydrated: true, persistence: "PERSISTED", records: Object.freeze([]) });
    } catch {
      this.replace({ hydrated: true, persistence: "UNAVAILABLE", records: this.snapshot.records });
    }
    return this.snapshot;
  }

  private safeRead(): string | null {
    try { return this.storage.read(); } catch { return null; }
  }

  private persist(records: OperationalTelemetry[]): OperationalHistorySnapshot {
    try {
      this.storage.write(JSON.stringify(records));
      this.replace({ hydrated: true, persistence: "PERSISTED", records: Object.freeze(records) });
    } catch {
      this.replace({ hydrated: true, persistence: "UNAVAILABLE", records: Object.freeze(records) });
    }
    return this.snapshot;
  }

  private replace(value: OperationalHistorySnapshot): void {
    this.snapshot = Object.freeze(value);
    for (const listener of this.listeners) listener();
  }
}

function browserStorage(): OperationalTelemetryStorage {
  return {
    read: () => localStorage.getItem(OPERATIONAL_TELEMETRY_STORAGE_KEY),
    write: (value) => localStorage.setItem(OPERATIONAL_TELEMETRY_STORAGE_KEY, value),
    remove: () => localStorage.removeItem(OPERATIONAL_TELEMETRY_STORAGE_KEY),
  };
}

export const localOperationalTelemetry = new LocalOperationalTelemetryJournal(browserStorage());
