import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { SavedQuery, HistoryEntry, SearchSavedQuery, SearchHistoryEntry, FlatField } from '../types';

export interface CachedMapping {
  key: string; // `${connectionId}::${index}`
  fields: FlatField[];
  fetchedAt: number;
}

export interface VixSchema extends DBSchema {
  savedQueries: { key: string; value: SavedQuery };
  history: { key: string; value: HistoryEntry; indexes: { 'by-ranAt': number } };
  mappingCache: { key: string; value: CachedMapping };
  searchSavedQueries: { key: string; value: SearchSavedQuery };
  searchHistory: { key: string; value: SearchHistoryEntry; indexes: { 'by-ranAt': number } };
}

let dbPromise: Promise<IDBPDatabase<VixSchema>> | undefined;

export function getDb(): Promise<IDBPDatabase<VixSchema>> {
  if (!dbPromise) {
    // Guard every createObjectStore with contains(): a fresh install runs upgrade
    // from version 0 and must create all stores, while an existing v1 database only
    // needs the v2 additions.
    dbPromise = openDB<VixSchema>('elasticvix', 2, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('savedQueries')) {
          db.createObjectStore('savedQueries', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('history')) {
          const hist = db.createObjectStore('history', { keyPath: 'id' });
          hist.createIndex('by-ranAt', 'ranAt');
        }
        if (!db.objectStoreNames.contains('mappingCache')) {
          db.createObjectStore('mappingCache', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('searchSavedQueries')) {
          db.createObjectStore('searchSavedQueries', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('searchHistory')) {
          const searchHist = db.createObjectStore('searchHistory', { keyPath: 'id' });
          searchHist.createIndex('by-ranAt', 'ranAt');
        }
      },
    });
  }
  return dbPromise;
}
