export type AuthConfig =
  | { type: 'none' }
  | { type: 'basic'; username: string; password: string }
  | { type: 'apiKey'; apiKey: string }
  | { type: 'bearer'; token: string };

export type EsMajor = 6 | 7 | 8 | 9;

export interface Connection {
  id: string;
  name: string;
  baseUrl: string; // e.g. https://host:9200 (no trailing slash)
  auth: AuthConfig;
  version?: string;
  major?: EsMajor;
  createdAt: number;
  updatedAt: number;
}

export interface SavedQuery {
  id: string;
  name: string;
  tags: string[];
  method: string;
  path: string;
  body: string;
  connectionId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface HistoryEntry {
  id: string;
  method: string;
  path: string;
  body: string;
  connectionId: string;
  status?: number;
  took?: number;
  ranAt: number;
}

export interface FlatField {
  path: string; // dotted, e.g. "user.address.city"
  type: string; // keyword/text/date/long/...
}
