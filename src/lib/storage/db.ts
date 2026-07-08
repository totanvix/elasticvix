import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { SavedQuery, HistoryEntry, FlatField } from '../types';

export interface CachedMapping {
  key: string; // `${connectionId}::${index}`
  fields: FlatField[];
  fetchedAt: number;
}

export interface VixSchema extends DBSchema {
  savedQueries: { key: string; value: SavedQuery };
  history: { key: string; value: HistoryEntry; indexes: { 'by-ranAt': number } };
  mappingCache: { key: string; value: CachedMapping };
}

let dbPromise: Promise<IDBPDatabase<VixSchema>> | undefined;

export function getDb(): Promise<IDBPDatabase<VixSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<VixSchema>('elasticvix', 1, {
      upgrade(db) {
        db.createObjectStore('savedQueries', { keyPath: 'id' });
        const hist = db.createObjectStore('history', { keyPath: 'id' });
        hist.createIndex('by-ranAt', 'ranAt');
        db.createObjectStore('mappingCache', { keyPath: 'key' });
      },
    });
  }
  return dbPromise;
}
