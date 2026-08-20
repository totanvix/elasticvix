import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { json } from '@codemirror/lang-json';
import { syntaxTree } from '@codemirror/language';
import type { SyntaxNode } from '@lezer/common';
import type { FlatField } from '../types';
import { spec as defaultSpec, type SpecData, type BodyNode, type ValueDesc } from './spec';
import { resolveKeyPath } from './keyPath';
import { splitBlocks, blockAt, type RequestBlock } from './requestBlocks';

export interface CompletionItem {
  label: string;
  kind: 'keyword' | 'field' | 'value';
  detail?: string;
}

export type Resolved =
  | { kind: 'object'; node: BodyNode }
  | { kind: 'array'; elem: string }
  | { kind: 'field' }
  | { kind: 'any' }
  | { kind: 'enum'; values: string[] }
  | { kind: 'leaf' };

export function resolveDesc(spec: SpecData, desc: ValueDesc): Resolved {
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

// At a value position, returns the enclosing key when it is a real keyword
// field of the target index — the signal to suggest that field's actual
// values. Skips trailing array-index segments (e.g. terms: { field: [ "|" ] }).
export function resolveValueField(
  path: string[],
  inKey: boolean,
  fields: FlatField[],
): string | undefined {
  if (inKey) return undefined;
  for (let i = path.length - 1; i >= 0; i--) {
    const segment = path[i]!;
    if (!/^\d+$/.test(segment)) {
      // This is not an array index; it's the field name
      const field = fields.find((f) => f.path === segment);
      return field?.type === 'keyword' ? field.path : undefined;
    }
  }
  return undefined;
}

// The block containing `pos`, but only when `pos` sits inside its JSON body —
// not on a request line, a blank separator line, or in leading junk. Only that
// body sub-range is ever parsed as JSON: request lines are not JSON and would
// corrupt the syntax tree.
function bodyBlockAt(docText: string, pos: number): RequestBlock | undefined {
  const block = blockAt(splitBlocks(docText), pos);
  if (!block || pos < block.bodyFrom || pos > block.bodyTo) return undefined;
  return block;
}

// Compute completions for a whole editor document: one or more requests, each
// a `METHOD /path` line followed by an optional JSON body.
export function docCompletions(docText: string, pos: number, fields: FlatField[]): CompletionItem[] {
  const block = bodyBlockAt(docText, pos);
  const rootRef = block?.endpoint ? defaultSpec.endpoints[block.endpoint]?.bodyRef : undefined;
  if (!block || !rootRef) return [];

  const bodyState = EditorState.create({ doc: block.bodyText, extensions: [json()] });
  const { path, inKey } = resolveKeyPath(bodyState, pos - block.bodyFrom);
  return resolveCompletions(defaultSpec, rootRef, path, inKey, fields);
}

const KIND_TO_CM: Record<CompletionItem['kind'], string> = {
  keyword: 'keyword',
  field: 'property',
  value: 'enum',
};

// Start of the JSON string content (just past the opening quote) enclosing
// `pos`, or null when `pos` is not inside a string's editable span. This is the
// completion's replacement start: without it, `matchBefore(/[\w.]*/)` stops at
// the first backslash/@/space, so a value like `App\\Viec\\Models\\Worker\\` is
// appended after — not replaced by — the accepted suggestion, and nothing filters.
// `resolveInner(pos, -1)` also enters a node that *ends* at pos, so a caret just
// past the closing quote would map onto the string and let an accept eat that
// quote — hence the explicit span check.
function stringContentStart(state: EditorState, pos: number): number | null {
  for (let n: SyntaxNode | null = syntaxTree(state).resolveInner(pos, -1); n; n = n.parent) {
    if (n.name === 'String' || n.name === 'PropertyName') {
      const terminated = n.to - n.from >= 2 && state.sliceDoc(n.to - 1, n.to) === '"';
      const contentEnd = terminated ? n.to - 1 : n.to;
      return pos >= n.from + 1 && pos <= contentEnd ? n.from + 1 : null;
    }
  }
  return null;
}

// Value-string replacement start for the REST console (multi-request document).
export function docStringStart(docText: string, pos: number): number | null {
  const block = bodyBlockAt(docText, pos);
  if (!block) return null;
  const state = EditorState.create({ doc: block.bodyText, extensions: [json()] });
  const start = stringContentStart(state, pos - block.bodyFrom);
  return start === null ? null : start + block.bodyFrom;
}

// Value-string replacement start for the Search page (body-only document).
export function bodyStringStart(docText: string, pos: number): number | null {
  const state = EditorState.create({ doc: docText, extensions: [json()] });
  return stringContentStart(state, pos);
}

// Escape a raw value so it matches the doc text inside a `"..."`: the completion
// runs inside a JSON string, so the label must be escaped to both filter against
// the already-typed prefix and insert as valid JSON.
export function escapeJsonString(value: string): string {
  return JSON.stringify(value).slice(1, -1);
}

// A CodeMirror option whose label is escaped for the JSON-string context, with
// the readable raw value kept as displayLabel when they differ.
function toCompletion(rawLabel: string, type: string, detail?: string): Completion {
  const label = escapeJsonString(rawLabel);
  return label === rawLabel ? { label, type, detail } : { label, displayLabel: rawLabel, type, detail };
}

// Compute completions for a body-only document (Search page): the whole doc is
// the JSON body of a `_search` request — there is no request line to strip.
export function bodyCompletions(docText: string, pos: number, fields: FlatField[]): CompletionItem[] {
  const rootRef = defaultSpec.endpoints['_search']?.bodyRef ?? 'queryBody';
  const state = EditorState.create({ doc: docText, extensions: [json()] });
  const { path, inKey } = resolveKeyPath(state, pos);
  return resolveCompletions(defaultSpec, rootRef, path, inKey, fields);
}

// Value-field detection for the Search page (body-only document).
export function bodyValueField(docText: string, pos: number, fields: FlatField[]): string | undefined {
  const state = EditorState.create({ doc: docText, extensions: [json()] });
  const { path, inKey } = resolveKeyPath(state, pos);
  return resolveValueField(path, inKey, fields);
}

// Value-field detection for the REST console (multi-request document).
export function docValueField(docText: string, pos: number, fields: FlatField[]): string | undefined {
  const block = bodyBlockAt(docText, pos);
  if (!block) return undefined; // on a request line / between blocks / no body
  const state = EditorState.create({ doc: block.bodyText, extensions: [json()] });
  const { path, inKey } = resolveKeyPath(state, pos - block.bodyFrom);
  return resolveValueField(path, inKey, fields);
}

// CodeMirror source for the Search page editor. `getFields` is already scoped
// to the selected indices by the caller, so it takes no index argument.
export function bodyCompletionSource(
  getFields: () => Promise<FlatField[]>,
  getFieldValues: (field: string) => Promise<string[]> = async () => [],
) {
  return async (ctx: CompletionContext): Promise<CompletionResult | null> => {
    const fields = await getFields();
    const docText = ctx.state.doc.toString();
    const items = bodyCompletions(docText, ctx.pos, fields);
    const word = ctx.matchBefore(/[\w.]*/);
    const from = bodyStringStart(docText, ctx.pos) ?? (word ? word.from : ctx.pos);

    if (items.length === 0) {
      const field = bodyValueField(docText, ctx.pos, fields);
      if (field) {
        const values = await getFieldValues(field);
        if (values.length > 0) {
          return { from, options: values.map((v) => toCompletion(v, 'enum')) };
        }
      }
      return null;
    }
    return { from, options: items.map((it) => toCompletion(it.label, KIND_TO_CM[it.kind], it.detail)) };
  };
}

// CodeMirror completion source used by the UI (Plan 2). `getFields` resolves the
// target index's fields (from cache or a fresh _mapping fetch).
export function esCompletionSource(
  getFields: (index?: string) => Promise<FlatField[]>,
  getFieldValues: (index: string | undefined, field: string) => Promise<string[]> = async () => [],
) {
  return async (ctx: CompletionContext): Promise<CompletionResult | null> => {
    const docText = ctx.state.doc.toString();
    const block = bodyBlockAt(docText, ctx.pos);
    if (!block) return null;

    const fields = await getFields(block.index);
    const items = docCompletions(docText, ctx.pos, fields);
    const word = ctx.matchBefore(/[\w.]*/);
    const from = docStringStart(docText, ctx.pos) ?? (word ? word.from : ctx.pos);

    if (items.length === 0) {
      const field = docValueField(docText, ctx.pos, fields);
      if (field) {
        const values = await getFieldValues(block.index, field);
        if (values.length > 0) {
          return { from, options: values.map((v) => toCompletion(v, 'enum')) };
        }
      }
      return null;
    }
    return { from, options: items.map((it) => toCompletion(it.label, KIND_TO_CM[it.kind], it.detail)) };
  };
}
