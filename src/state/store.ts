import type { SeededRecord, SeededStore } from '../../shared/types.js';

class Store {
  private baseline: SeededStore = {};
  private current: SeededStore = {};
  private snapshots = new Map<string, SeededStore>();

  init(seed: SeededStore): void {
    this.baseline = structuredClone(seed);
    this.current = structuredClone(seed);
  }

  reset(): Record<string, number> {
    this.current = structuredClone(this.baseline);
    return this.counts();
  }

  resetModel(name: string, records?: SeededRecord[]): number {
    if (records) {
      this.baseline[name] = structuredClone(records);
    }
    const baseline = this.baseline[name];
    if (!baseline) return 0;
    this.current[name] = structuredClone(baseline);
    return this.current[name].length;
  }

  all(): SeededStore {
    return this.current;
  }

  model(name: string): SeededRecord[] | undefined {
    return this.current[name];
  }

  setModel(name: string, records: SeededRecord[]): void {
    this.current[name] = records;
  }

  saveSnapshot(name: string): Record<string, number> {
    this.snapshots.set(name, structuredClone(this.current));
    return this.snapshotSummary(name);
  }

  restoreSnapshot(name: string): Record<string, number> | null {
    const snapshot = this.snapshots.get(name);
    if (!snapshot) return null;
    this.current = structuredClone(snapshot);
    return this.counts();
  }

  listSnapshots(): Array<{ name: string; models: Record<string, number> }> {
    return Array.from(this.snapshots.keys()).map((name) => ({ name, models: this.snapshotSummary(name) }));
  }

  snapshotSummary(name: string): Record<string, number> {
    const snapshot = this.snapshots.get(name) ?? {};
    return Object.fromEntries(Object.entries(snapshot).map(([model, records]) => [model, records.length]));
  }

  counts(): Record<string, number> {
    return Object.fromEntries(Object.entries(this.current).map(([name, records]) => [name, records.length]));
  }

  totalRecords(): number {
    return Object.values(this.current).reduce((sum, records) => sum + records.length, 0);
  }
}

export default new Store();
