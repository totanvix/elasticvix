import { useCallback, useEffect, useRef, useState } from 'react';
import type { Connection, FlatField } from '../../lib/types';
import type { MappingResult } from '../../lib/rpc/messages';
import { getCachedFields, setCachedFields } from '../../lib/storage/mappingCache';
import { fetchMapping } from '../../lib/rpc/client';

type FetchMapping = (connection: Connection, index: string) => Promise<MappingResult>;

// Cache-first mapping loader. `fetch` injectable for tests. Surfaces errors so the UI can
// distinguish "index has no fields" from "fetch failed" (unlike makeGetFields, which returns []).
export function makeLoadMapping(connection: Connection | undefined, fetch: FetchMapping = fetchMapping) {
  return async (index: string | undefined, opts?: { skipCache?: boolean }): Promise<MappingResult> => {
    if (!connection || !index) return { fields: [] };
    if (!opts?.skipCache) {
      const cached = await getCachedFields(connection.id, index);
      if (cached) return { fields: cached };
    }
    const res = await fetch(connection, index);
    if (res.error) return { fields: [], error: res.error };
    await setCachedFields(connection.id, index, res.fields);
    return { fields: res.fields };
  };
}

export type IndexMappingState = {
  fields: FlatField[];
  isLoading: boolean;
  error?: string;
  reload: () => Promise<void>;
};

export function useIndexMapping(
  connection: Connection | undefined,
  index: string | undefined,
): IndexMappingState {
  const [fields, setFields] = useState<FlatField[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const loadSeq = useRef(0);

  const run = useCallback(
    async (skipCache: boolean) => {
      loadSeq.current += 1;
      const seq = loadSeq.current;
      if (!connection || !index) {
        setFields([]);
        setError(undefined);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(undefined);
      const res = await makeLoadMapping(connection)(index, { skipCache });
      if (seq !== loadSeq.current) return;
      setFields(res.fields);
      setError(res.error);
      setLoading(false);
    },
    [connection, index],
  );

  useEffect(() => {
    void run(false);
  }, [run]);

  const reload = useCallback(() => run(true), [run]);
  return { fields, isLoading, error, reload };
}
