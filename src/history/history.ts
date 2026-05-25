import type { MutationHistoryEntry, RequestSnapshot, SeededRecord } from '../../shared/types.js';

const mutationHistory: MutationHistoryEntry[] = [];
const requestSnapshots: RequestSnapshot[] = [];
const MAX_HISTORY = 300;

export function recordMutation(entry: Omit<MutationHistoryEntry, 'id' | 'timestamp'>): void {
  mutationHistory.push({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...entry,
  });
  if (mutationHistory.length > MAX_HISTORY) mutationHistory.splice(0, mutationHistory.length - MAX_HISTORY);
}

export function getMutationHistory(): MutationHistoryEntry[] {
  return [...mutationHistory].reverse();
}

export function clearMutationHistory(): void {
  mutationHistory.length = 0;
}

export function recordRequest(snapshot: Omit<RequestSnapshot, 'timestamp'>): void {
  requestSnapshots.push({
    timestamp: new Date().toISOString(),
    ...snapshot,
  });
  if (requestSnapshots.length > MAX_HISTORY) requestSnapshots.splice(0, requestSnapshots.length - MAX_HISTORY);
}

export function getRequestSnapshots(): RequestSnapshot[] {
  return [...requestSnapshots].reverse();
}

export function cloneRecord(record: SeededRecord | null | undefined): SeededRecord | null {
  return record ? structuredClone(record) : null;
}
