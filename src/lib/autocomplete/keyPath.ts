import { EditorState } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import type { SyntaxNode } from '@lezer/common';

function unquote(s: string): string {
  return s.replace(/^"/, '').replace(/"$/, '');
}

export function resolveKeyPath(
  state: EditorState,
  pos: number,
): { path: string[]; inKey: boolean } {
  const tree = syntaxTree(state);
  const inner: SyntaxNode = tree.resolveInner(pos, -1);
  const path: string[] = [];

  // Value position when the cursor is inside a Property's value (after the ':').
  let inKey = true;
  for (let n: SyntaxNode | null = inner; n; n = n.parent) {
    if (n.name === 'Property') {
      const nameNode = n.getChild('PropertyName');
      // If the cursor is past the property name, we're in the value → not a key.
      if (nameNode && pos > nameNode.to) inKey = false;
      break;
    }
    if (n.name === 'Object' || n.name === 'JsonText') break;
  }

  // Build the path from enclosing Property names (outermost last → reverse at end).
  for (let n: SyntaxNode | null = inner; n; n = n.parent) {
    if (n.name === 'Property') {
      const nameNode = n.getChild('PropertyName');
      if (nameNode) path.unshift(unquote(state.sliceDoc(nameNode.from, nameNode.to)));
    }
    if (n.name === 'Array') {
      // Count value children that end before the cursor → array index.
      let idx = 0;
      for (let c = n.firstChild; c; c = c.nextSibling) {
        if (c.name === '[' || c.name === ']' || c.name === ',') continue;
        if (c.to <= pos) idx++;
        else break;
      }
      path.unshift(String(idx));
    }
  }

  // When we are typing the key itself, that partial key is NOT part of the path.
  if (inKey && inner.name === 'PropertyName') path.pop();

  return { path, inKey };
}
