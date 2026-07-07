import type { FlatField } from '../types';

interface MappingNode {
  type?: string;
  properties?: Record<string, MappingNode>;
  fields?: Record<string, MappingNode>;
}

export function flattenProperties(
  properties: Record<string, MappingNode> | undefined,
  prefix = '',
): FlatField[] {
  if (!properties) return [];
  const out: FlatField[] = [];
  for (const [name, node] of Object.entries(properties)) {
    const path = prefix ? `${prefix}.${name}` : name;
    if (node.properties) {
      out.push(...flattenProperties(node.properties, path));
    } else {
      out.push({ path, type: node.type ?? 'object' });
      if (node.fields) {
        for (const [sub, subNode] of Object.entries(node.fields)) {
          out.push({ path: `${path}.${sub}`, type: subNode.type ?? 'keyword' });
        }
      }
    }
  }
  return out;
}

export function flattenMapping(mappingsForIndex: unknown): FlatField[] {
  const m = mappingsForIndex as { properties?: Record<string, MappingNode> } & Record<string, any>;
  if (m && m.properties) return flattenProperties(m.properties); // ES7+
  const out: FlatField[] = []; // ES6: iterate the (usually single) type
  for (const key of Object.keys(m ?? {})) {
    const node = m[key];
    if (node && typeof node === 'object' && node.properties) {
      out.push(...flattenProperties(node.properties));
    }
  }
  return out;
}
