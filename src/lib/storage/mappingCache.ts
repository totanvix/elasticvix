import { getDb } from './db';
import type { FlatField } from '../types';

export const MAPPING_TTL_MS = 5 * 60 * 1000;

function keyOf(connectionId: string, index: string): string {
  return `${connectionId}::${index}`;
}

export async function getCachedFields(
  connectionId: string,
  index: string,
  now: number = Date.now(),
): Promise<FlatField[] | undefined> {
  const row = await (await getDb()).get('mappingCache', keyOf(connectionId, index));
  if (!row) return undefined;
  if (now - row.fetchedAt > MAPPING_TTL_MS) return undefined;
  return row.fields;
}

export async function setCachedFields(
  connectionId: string,
  index: string,
  fields: FlatField[],
  now: number = Date.now(),
): Promise<void> {
  await (await getDb()).put('mappingCache', { key: keyOf(connectionId, index), fields, fetchedAt: now });
}
