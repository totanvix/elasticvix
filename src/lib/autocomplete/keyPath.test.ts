import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { json } from '@codemirror/lang-json';
import { resolveKeyPath } from './keyPath';

function stateAt(text: string): { state: EditorState; pos: number } {
  const pos = text.indexOf('|');
  const doc = text.replace('|', '');
  return { state: EditorState.create({ doc, extensions: [json()] }), pos };
}

describe('resolveKeyPath', () => {
  it('detects a top-level key position', () => {
    const { state, pos } = stateAt('{ "|" }');
    expect(resolveKeyPath(state, pos)).toEqual({ path: [], inKey: true });
  });
  it('detects a nested key position inside query.bool', () => {
    const { state, pos } = stateAt('{ "query": { "bool": { "|" } } }');
    const r = resolveKeyPath(state, pos);
    expect(r.path).toEqual(['query', 'bool']);
    expect(r.inKey).toBe(true);
  });
  it('detects a value position after a key', () => {
    const { state, pos } = stateAt('{ "query": { "exists": { "field": "|" } } }');
    const r = resolveKeyPath(state, pos);
    expect(r.path).toEqual(['query', 'exists', 'field']);
    expect(r.inKey).toBe(false);
  });
  it('detects a key position while typing an unterminated key on incomplete JSON', () => {
    // Live-typing: cursor at the very end of an in-progress, still-unterminated key
    // one level under `query`. We should suggest keys valid inside `query`.
    const { state, pos } = stateAt('{ "query": { "bo|');
    const r = resolveKeyPath(state, pos);
    expect(r.path).toEqual(['query']);
    expect(r.inKey).toBe(true);
  });
});
