import { useCallback, useEffect, useRef, useState } from 'react';
import type { Connection } from '../../lib/types';
import { esRequest } from '../../lib/rpc/client';
import { parseCatIndices, type IndexInfo } from './indicesLib';

const CAT_INDICES_PATH = '/_cat/indices?format=json&h=index,health,docs.count';

export function useIndices(active: Connection | undefined) {
  const [indices, setIndices] = useState<IndexInfo[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const loadSeq = useRef(0);

  const reload = useCallback(async () => {
    if (!active) {
      setIndices([]);
      setError(undefined);
      return;
    }
    const seq = ++loadSeq.current;
    setLoading(true);
    setError(undefined);
    try {
      const res = await esRequest(active, 'GET', CAT_INDICES_PATH);
      if (seq !== loadSeq.current) return;
      if (res.error) {
        setIndices([]);
        setError(res.error);
      } else if (res.status >= 400) {
        setIndices([]);
        setError(`HTTP ${res.status}`);
      } else {
        setIndices(parseCatIndices(res.body));
      }
    } catch (e) {
      if (seq === loadSeq.current) {
        setIndices([]);
        setError(e instanceof Error ? e.message : 'Failed to load indices');
      }
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [active]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { indices, isLoading, error, reload };
}
