import {
  dismiss,
  loadEngagement,
  recordRun,
  saveEngagement,
  snooze,
  type EngagementState,
} from './engagementLib';

// Tiny external store so any component can react to run counts
// without prop drilling (consumed via useSyncExternalStore).
let snapshot: EngagementState = loadEngagement();
let listeners: ReadonlyArray<() => void> = [];

function update(next: EngagementState): void {
  snapshot = next;
  saveEngagement(next);
  listeners.forEach((l) => l());
}

export function subscribeEngagement(listener: () => void): () => void {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function getEngagement(): EngagementState {
  return snapshot;
}

export function recordEngagementRun(): void {
  update(recordRun(snapshot));
}

export function snoozeEngagement(): void {
  update(snooze(snapshot));
}

export function dismissEngagement(): void {
  update(dismiss(snapshot));
}
