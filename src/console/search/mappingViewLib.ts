import type { FlatField } from '../../lib/types';

export type TypeClass = 'keyword' | 'text' | 'date' | 'number' | 'boolean' | 'other';

const NUMBER_TYPES = new Set([
  'long', 'integer', 'short', 'byte', 'double', 'float', 'half_float', 'scaled_float', 'unsigned_long',
]);

export function typeClass(type: string): TypeClass {
  if (type === 'keyword') return 'keyword';
  if (type === 'text' || type === 'match_only_text') return 'text';
  if (type === 'date' || type === 'date_nanos') return 'date';
  if (type === 'boolean') return 'boolean';
  if (NUMBER_TYPES.has(type)) return 'number';
  return 'other';
}

export function sortFields(fields: FlatField[]): FlatField[] {
  return [...fields].sort((a, b) => a.path.localeCompare(b.path));
}

export function filterFields(fields: FlatField[], query: string): FlatField[] {
  const q = query.trim().toLowerCase();
  if (!q) return fields;
  return fields.filter((f) => f.path.toLowerCase().includes(q));
}
