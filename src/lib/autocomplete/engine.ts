import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { json } from '@codemirror/lang-json';
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

// Compute completions for a whole editor document: line 1 is `METHOD /path`,
// the remaining lines are the JSON body. Only the body sub-range is parsed as
// JSON — line 1 is not JSON and would corrupt the syntax tree.
export function docCompletions(docText: string, pos: number, fields: FlatField[]): CompletionItem[] {
  const nl = docText.indexOf('\n');
  if (nl === -1 || pos <= nl) return []; // still on the request line (or no body)

  const { endpoint } = parseRequestLine(docText.slice(0, nl));
  const rootRef = endpoint ? defaultSpec.endpoints[endpoint]?.bodyRef : undefined;
  if (!rootRef) return [];

  const bodyStart = nl + 1;
  const bodyState = EditorState.create({ doc: docText.slice(bodyStart), extensions: [json()] });
  const { path, inKey } = resolveKeyPath(bodyState, pos - bodyStart);
  return resolveCompletions(defaultSpec, rootRef, path, inKey, fields);
}

const KIND_TO_CM: Record<CompletionItem['kind'], string> = {
  keyword: 'keyword',
  field: 'property',
  value: 'enum',
};

// Compute completions for a body-only document (Search page): the whole doc is
// the JSON body of a `_search` request — there is no request line to strip.
export function bodyCompletions(docText: string, pos: number, fields: FlatField[]): CompletionItem[] {
  const rootRef = defaultSpec.endpoints['_search']?.bodyRef ?? 'queryBody';
  const state = EditorState.create({ doc: docText, extensions: [json()] });
  const { path, inKey } = resolveKeyPath(state, pos);
  return resolveCompletions(defaultSpec, rootRef, path, inKey, fields);
}

// CodeMirror source for the Search page editor. `getFields` is already scoped
// to the selected indices by the caller, so it takes no index argument.
export function bodyCompletionSource(getFields: () => Promise<FlatField[]>) {
  return async (ctx: CompletionContext): Promise<CompletionResult | null> => {
    const fields = await getFields();
    const items = bodyCompletions(ctx.state.doc.toString(), ctx.pos, fields);
    if (items.length === 0) return null;

    const word = ctx.matchBefore(/[\w.]*/);
    return {
      from: word ? word.from : ctx.pos,
      options: items.map((it) => ({ label: it.label, type: KIND_TO_CM[it.kind], detail: it.detail })),
    };
  };
}

// CodeMirror completion source used by the UI (Plan 2). `getFields` resolves the
// target index's fields (from cache or a fresh _mapping fetch).
export function esCompletionSource(getFields: (index?: string) => Promise<FlatField[]>) {
  return async (ctx: CompletionContext): Promise<CompletionResult | null> => {
    const docText = ctx.state.doc.toString();
    const nl = docText.indexOf('\n');
    if (nl === -1 || ctx.pos <= nl) return null;

    const { index } = parseRequestLine(docText.slice(0, nl));
    const fields = await getFields(index);
    const items = docCompletions(docText, ctx.pos, fields);
    if (items.length === 0) return null;

    const word = ctx.matchBefore(/[\w.]*/);
    return {
      from: word ? word.from : ctx.pos,
      options: items.map((it) => ({ label: it.label, type: KIND_TO_CM[it.kind], detail: it.detail })),
    };
  };
}
