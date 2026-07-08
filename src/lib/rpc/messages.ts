import type { Connection, EsMajor, FlatField } from '../types';

export interface EsResult { status: number; took: number; body: unknown; error?: string }
export interface VersionResult { version?: string; major?: EsMajor; error?: string }
export interface MappingResult { fields: FlatField[]; error?: string }

export type RpcRequest =
  | { kind: 'esRequest'; connection: Connection; method: string; path: string; body?: string }
  | { kind: 'detectVersion'; connection: Connection }
  | { kind: 'fetchMapping'; connection: Connection; index: string };

export type RpcResponse =
  | { kind: 'esRequest'; result: EsResult }
  | { kind: 'detectVersion'; result: VersionResult }
  | { kind: 'fetchMapping'; result: MappingResult };
