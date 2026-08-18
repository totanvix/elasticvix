import { splitBlocks } from '../../lib/autocomplete/requestBlocks';
import { spec as defaultSpec } from '../../lib/autocomplete/spec';

export interface LintTarget {
  bodyText: string;
  bodyFrom: number;
  index?: string;
  bodyRef: string;
}

// Blocks worth linting: the endpoint must have a body spec, the target must be
// a single concrete index (a wildcard/multi mapping fetch only returns the
// first concrete index, so a partial mapping would flag valid fields), and the
// body must be non-empty.
export function lintTargets(docText: string): LintTarget[] {
  const out: LintTarget[] = [];
  for (const block of splitBlocks(docText)) {
    const bodyRef = block.endpoint ? defaultSpec.endpoints[block.endpoint]?.bodyRef : undefined;
    if (!bodyRef) continue;
    if (block.index && /[*,]/.test(block.index)) continue;
    if (!block.bodyText) continue;
    out.push({ bodyText: block.bodyText, bodyFrom: block.bodyFrom, index: block.index, bodyRef });
  }
  return out;
}
