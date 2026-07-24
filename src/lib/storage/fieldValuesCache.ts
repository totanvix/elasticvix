import { getDb } from './db';

export const FIELD_VALUES_TTL_MS = 5 * 60 * 1000;

function keyOf(connectionId: string, index: string, field: string): string {
  return `${connectionId}::${index}::${field}`;
}

export async function getCachedFieldValues(
  connectionId: string,
  index: string,
  field: string,
  now: number = Date.now(),
): Promise<string[] | undefined> {
  const row = await (await getDb()).get('fieldValuesCache', keyOf(connectionId, index, field));
  if (!row) return undefined;
  if (now - row.fetchedAt > FIELD_VALUES_TTL_MS) return undefined;
  return row.values;
}

export async function setCachedFieldValues(
  connectionId: string,
  index: string,
  field: string,
  values: string[],
  now: number = Date.now(),
): Promise<void> {
  await (await getDb()).put('fieldValuesCache', {
    key: keyOf(connectionId, index, field),
    values,
    fetchedAt: now,
  });
}
