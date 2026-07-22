import { useCallback, useEffect, useState } from 'react';

export function hiddenColumnsKey(connectionId: string): string {
  return `elasticvix.search.hiddenColumns.${connectionId}`;
}

export function loadHiddenColumns(connectionId: string): Set<string> {
  try {
    const raw = localStorage.getItem(hiddenColumnsKey(connectionId));
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return new Set(parsed.filter((c): c is string => typeof c === 'string'));
      }
    }
  } catch {
    /* corrupted state falls back to no hidden columns */
  }
  return new Set();
}

export function saveHiddenColumns(connectionId: string, hidden: Set<string>): void {
  localStorage.setItem(hiddenColumnsKey(connectionId), JSON.stringify([...hidden]));
}

export function toggleHidden(hidden: Set<string>, column: string): Set<string> {
  const next = new Set(hidden);
  if (next.has(column)) next.delete(column);
  else next.add(column);
  return next;
}

export function useHiddenColumns(connectionId: string) {
  const [hidden, setHidden] = useState<Set<string>>(() => loadHiddenColumns(connectionId));

  // Reload the persisted set whenever the active connection changes.
  useEffect(() => {
    setHidden(loadHiddenColumns(connectionId));
  }, [connectionId]);

  const toggle = useCallback(
    (column: string) => {
      setHidden((prev) => {
        const next = toggleHidden(prev, column);
        saveHiddenColumns(connectionId, next);
        return next;
      });
    },
    [connectionId],
  );

  const showAll = useCallback(() => {
    const next = new Set<string>();
    setHidden(next);
    saveHiddenColumns(connectionId, next);
  }, [connectionId]);

  return { hidden, toggle, showAll };
}
