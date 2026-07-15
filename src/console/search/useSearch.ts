import { useCallback, useEffect, useRef, useState } from 'react';
import type { Connection } from '../../lib/types';
import type { EsResult } from '../../lib/rpc/messages';
import { esRequest } from '../../lib/rpc/client';
import { buildSearchPath, mergeFromSize, normalizeTotal, type TotalInfo } from './searchLib';

export const DEFAULT_QUERY = '{\n  "query": {\n    "match_all": {}\n  }\n}';
export const PAGE_SIZES = [10, 25, 50, 100] as const;
const DEFAULT_SIZE = 25;

interface PersistedSearch {
  selected: string[];
  queryText: string;
}

function storageKey(connectionId: string): string {
  return `elasticvix.search.${connectionId}`;
}

function loadPersisted(connectionId: string): PersistedSearch {
  try {
    const raw = localStorage.getItem(storageKey(connectionId));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedSearch>;
      return {
        selected: Array.isArray(parsed.selected)
          ? parsed.selected.filter((s): s is string => typeof s === 'string')
          : [],
        queryText: typeof parsed.queryText === 'string' ? parsed.queryText : DEFAULT_QUERY,
      };
    }
  } catch {
    /* corrupted state falls back to defaults */
  }
  return { selected: [], queryText: DEFAULT_QUERY };
}

function persist(connectionId: string, next: PersistedSearch): void {
  localStorage.setItem(storageKey(connectionId), JSON.stringify(next));
}

export function useSearch(active: Connection | undefined) {
  const [selected, setSelected] = useState<string[]>([]);
  const [queryText, setQueryText] = useState(DEFAULT_QUERY);
  const [response, setResponse] = useState<EsResult | undefined>(undefined);
  const [total, setTotal] = useState<TotalInfo | undefined>(undefined);
  const [isRunning, setRunning] = useState(false);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(DEFAULT_SIZE);
  const [inputError, setInputError] = useState<string | undefined>(undefined);
  const runSeq = useRef(0);

  const activeId = active?.id;

  // Reload persisted selection + query whenever the active connection changes.
  useEffect(() => {
    runSeq.current += 1;
    const persisted = activeId ? loadPersisted(activeId) : { selected: [], queryText: DEFAULT_QUERY };
    setSelected(persisted.selected);
    setQueryText(persisted.queryText);
    setResponse(undefined);
    setTotal(undefined);
    setPage(1);
    setInputError(undefined);
  }, [activeId]);

  const selectIndices = useCallback(
    (next: string[]) => {
      setSelected(next);
      setPage(1);
      if (activeId) persist(activeId, { selected: next, queryText });
    },
    [activeId, queryText],
  );

  const changeQuery = useCallback(
    (text: string) => {
      setQueryText(text);
      if (activeId) persist(activeId, { selected, queryText: text });
    },
    [activeId, selected],
  );

  const runAt = useCallback(
    async (nextPage: number, nextSize: number) => {
      if (!active || selected.length === 0) return;
      const body = mergeFromSize(queryText, (nextPage - 1) * nextSize, nextSize);
      if (body === undefined) {
        setInputError('Query is not valid JSON');
        return;
      }
      setInputError(undefined);
      const seq = ++runSeq.current;
      setRunning(true);
      try {
        const result = await esRequest(active, 'POST', buildSearchPath(selected), body);
        if (seq !== runSeq.current) return;
        setResponse(result);
        setTotal(result.status >= 200 && result.status < 300 ? normalizeTotal(result.body) : undefined);
        setPage(nextPage);
        setSize(nextSize);
      } finally {
        if (seq === runSeq.current) setRunning(false);
      }
    },
    [active, selected, queryText],
  );

  const runSearch = useCallback(() => runAt(1, size), [runAt, size]);
  const goToPage = useCallback((p: number) => runAt(p, size), [runAt, size]);
  const changeSize = useCallback((s: number) => runAt(1, s), [runAt]);

  return {
    selected,
    selectIndices,
    queryText,
    changeQuery,
    response,
    total,
    isRunning,
    page,
    size,
    inputError,
    runSearch,
    goToPage,
    changeSize,
  };
}
