import type { Connection, FlatField } from '../../lib/types';
import { getCachedFields, setCachedFields } from '../../lib/storage/mappingCache';
import { fetchMapping } from '../../lib/rpc/client';

// Returns the flattened fields for the request's target index, cached with TTL.
export function makeGetFields(connection: Connection | undefined) {
  return async (index?: string): Promise<FlatField[]> => {
    if (!connection || !index) return [];
    const cached = await getCachedFields(connection.id, index);
    if (cached) return cached;
    const res = await fetchMapping(connection, index);
    if (res.error) return [];
    await setCachedFields(connection.id, index, res.fields);
    return res.fields;
  };
}
