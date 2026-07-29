import { EditorState } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { json } from '@codemirror/lang-json';
import type { SyntaxNode } from '@lezer/common';
import type { FlatField } from '../types';
import { spec as defaultSpec, type ValueDesc } from './spec';
import { resolveDesc, type Resolved } from './engine';

export interface FieldRef {
  from: number;
  to: number;
  field: string;
}

const LEAF: Resolved = { kind: 'leaf' };
const VALUE_NODES = new Set(['Object', 'Array', 'String', 'Number', 'True', 'False', 'Null']);

function unquote(s: string): string {
  return s.replace(/^"/, '').replace(/"$/, '');
}

// Skip empty tokens and wildcard/boost patterns (e.g. `title^2`, `cat*`) — those
// are valid query syntax, not literal field names, and would be false positives.
function looksPattern(t: string): boolean {
  return t === '' || /[*?^]/.test(t);
}

function propertyValue(prop: SyntaxNode): SyntaxNode | null {
  for (let c = prop.firstChild; c; c = c.nextSibling) {
    if (VALUE_NODES.has(c.name)) return c;
  }
  return null;
}

// Walk the JSON body and report tokens sitting at a spec `@field` position that
// are not present in the index mapping. Pure: no IO. Returns [] when the mapping
// is unknown (empty) so an absent mapping never produces warnings.
export function findUnknownFields(bodyText: string, rootRef: string, fields: FlatField[]): FieldRef[] {
  if (fields.length === 0) return [];
  const fieldSet = new Set(fields.map((f) => f.path));
  const state = EditorState.create({ doc: bodyText, extensions: [json()] });
  const tree = syntaxTree(state);
  const rootValue = tree.topNode.firstChild;
  if (!rootValue) return [];

  const out: FieldRef[] = [];
  const check = (token: string, from: number, to: number) => {
    if (!looksPattern(token) && !fieldSet.has(token)) out.push({ from, to, field: token });
  };

  const visit = (node: SyntaxNode, resolved: Resolved): void => {
    if (node.name === 'Object') {
      if (resolved.kind !== 'object') return;
      const bodyNode = resolved.node;
      for (let c = node.firstChild; c; c = c.nextSibling) {
        if (c.name !== 'Property') continue;
        const nameNode = c.getChild('PropertyName');
        if (!nameNode) continue;
        const key = unquote(state.sliceDoc(nameNode.from, nameNode.to));
        let nextDesc: ValueDesc | undefined;
        if (key in bodyNode) {
          nextDesc = bodyNode[key];
        } else if ('@field' in bodyNode) {
          nextDesc = bodyNode['@field'];
          check(key, nameNode.from, nameNode.to);
        } else if ('@any' in bodyNode) {
          nextDesc = bodyNode['@any'];
        }
        const valueNode = propertyValue(c);
        if (valueNode) visit(valueNode, nextDesc === undefined ? LEAF : resolveDesc(defaultSpec, nextDesc));
      }
    } else if (node.name === 'Array') {
      if (resolved.kind !== 'array') return;
      const elemResolved = resolveDesc(defaultSpec, resolved.elem);
      for (let c = node.firstChild; c; c = c.nextSibling) {
        if (VALUE_NODES.has(c.name)) visit(c, elemResolved);
      }
    } else if (node.name === 'String') {
      if (resolved.kind === 'field') {
        check(unquote(state.sliceDoc(node.from, node.to)), node.from, node.to);
      }
    }
  };

  visit(rootValue, resolveDesc(defaultSpec, `#${rootRef}`));
  return out;
}
