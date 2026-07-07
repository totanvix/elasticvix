import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import type { FlatField } from '../types';
import { spec as defaultSpec, type SpecData, type BodyNode, type ValueDesc } from './spec';
import { resolveKeyPath } from './keyPath';
import { parseRequestLine } from './requestLine';

export interface CompletionItem {
  label: string;
  kind: 'keyword' | 'field' | 'value';
  detail?: string;
}

type Resolved =
  | { kind: 'object'; node: BodyNode }
  | { kind: 'array'; elem: string }
  | { kind: 'field' }
  | { kind: 'any' }
  | { kind: 'enum'; values: string[] }
  | { kind: 'leaf' };

function resolveDesc(spec: SpecData, desc: ValueDesc): Resolved {
  if (desc && typeof desc === 'object') return { kind: 'object', node: desc };
  const s = String(desc);
  if (s.startsWith('[') && s.endsWith(']')) return { kind: 'array', elem: s.slice(1, -1) };
  if (s.startsWith('#')) {
    const node = spec.bodies[s.slice(1)];
    return node ? { kind: 'object', node } : { kind: 'leaf' };
  }
  if (s === '@field') return { kind: 'field' };
  if (s === '@any') return { kind: 'any' };
  if (s.startsWith('enum:')) return { kind: 'enum', values: s.slice(5).split(',') };
  return { kind: 'leaf' };
}

function step(spec: SpecData, current: Resolved, key: string): Resolved {
  if (current.kind === 'array') return resolveDesc(spec, current.elem);
  if (current.kind === 'object') {
    const desc = current.node[key] ?? current.node['@field'] ?? current.node['@any'];
    return desc === undefined ? { kind: 'leaf' } : resolveDesc(spec, desc);
  }
  return { kind: 'leaf' };
}

function fieldItems(fields: FlatField[]): CompletionItem[] {
  return fields.map((f) => ({ label: f.path, kind: 'field', detail: f.type }));
}

export function resolveCompletions(
  spec: SpecData,
  rootRef: string,
  path: string[],
  inKey: boolean,
  fields: FlatField[],
): CompletionItem[] {
  let current = resolveDesc(spec, `#${rootRef}`);
  for (const key of path) current = step(spec, current, key);

  if (inKey) {
    if (current.kind === 'object') {
      const items: CompletionItem[] = [];
      for (const k of Object.keys(current.node)) {
        if (k === '@field') items.push(...fieldItems(fields));
        else if (k === '@any') continue;
        else items.push({ label: k, kind: 'keyword' });
      }
      return items;
    }
    if (current.kind === 'field') return fieldItems(fields);
    return [];
  }
  if (current.kind === 'field') return fieldItems(fields);
  if (current.kind === 'enum') return current.values.map((v) => ({ label: v, kind: 'value' }));
  return [];
}

const KIND_TO_CM: Record<CompletionItem['kind'], string> = {
  keyword: 'keyword',
  field: 'property',
  value: 'enum',
};

// CodeMirror completion source used by the UI (Plan 2).
export function esCompletionSource(getFields: (index?: string) => Promise<FlatField[]>) {
  return async (ctx: CompletionContext): Promise<CompletionResult | null> => {
    const firstLine = ctx.state.doc.line(1).text;
    const cursorLine = ctx.state.doc.lineAt(ctx.pos).number;

    // Request line (line 1): endpoint/method completion is minimal here; body is the focus.
    if (cursorLine === 1) return null;

    const { endpoint, index } = parseRequestLine(firstLine);
    const ep = endpoint ? defaultSpec.endpoints[endpoint] : undefined;
    const rootRef = ep?.bodyRef;
    if (!rootRef) return null;

    const { path, inKey } = resolveKeyPath(ctx.state, ctx.pos);
    const fields = await getFields(index);
    const items = resolveCompletions(defaultSpec, rootRef, path, inKey, fields);
    if (items.length === 0) return null;

    const word = ctx.matchBefore(/[\w.]*/);
    return {
      from: word ? word.from : ctx.pos,
      options: items.map((it) => ({ label: it.label, type: KIND_TO_CM[it.kind], detail: it.detail })),
    };
  };
}
