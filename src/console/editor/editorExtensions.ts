import { json } from '@codemirror/lang-json';
import { autocompletion } from '@codemirror/autocomplete';
import { linter, type Diagnostic } from '@codemirror/lint';
import type { Extension } from '@codemirror/state';
import type { FlatField } from '../../lib/types';
import { esCompletionSource } from '../../lib/autocomplete/engine';
import { findUnknownFields, type FieldRef } from '../../lib/autocomplete/lintFields';
import { spec as defaultSpec } from '../../lib/autocomplete/spec';
import { lintTargets } from './lintTargets';
import { activeBlockHighlight } from './activeBlockHighlight';

// The document holds one or more requests, each a `METHOD /path` line + an
// optional JSON body. We highlight with json() (good enough for the bodies)
// and drive field-aware completion via the engine's source, which parses only
// body sub-ranges.

function toDiagnostics(refs: FieldRef[], offset: number, index?: string): Diagnostic[] {
  const where = index ? ` of ${index}` : '';
  return refs.map((r) => ({
    from: offset + r.from,
    to: offset + r.to,
    severity: 'warning' as const,
    message: `"${r.field}" is not in the cached mapping${where}`,
  }));
}

// REST console: lint every lintable request block (see lintTargets for the
// skip rules), translating each block's diagnostics by its body offset. The
// mapping fetch is shared per lint pass so blocks hitting the same index only
// fetch once.
function restLinter(getFields: (index?: string) => Promise<FlatField[]>): Extension {
  return linter(async (view): Promise<Diagnostic[]> => {
    const targets = lintTargets(view.state.doc.toString());
    if (targets.length === 0) return [];
    const fieldsByIndex = new Map<string | undefined, Promise<FlatField[]>>();
    const fieldsFor = (index?: string): Promise<FlatField[]> => {
      const cached = fieldsByIndex.get(index);
      if (cached) return cached;
      const fetched = getFields(index);
      fieldsByIndex.set(index, fetched);
      return fetched;
    };
    const perTarget = await Promise.all(
      targets.map(async (t) => {
        const fields = await fieldsFor(t.index);
        return toDiagnostics(findUnknownFields(t.bodyText, t.bodyRef, fields), t.bodyFrom, t.index);
      }),
    );
    return perTarget.flat();
  });
}

// Search editor: the whole document is a `_search` body (no request line).
export function searchFieldLinter(getFields: () => Promise<FlatField[]>): Extension {
  const bodyRef = defaultSpec.endpoints['_search']?.bodyRef ?? 'queryBody';
  return linter(async (view): Promise<Diagnostic[]> => {
    const fields = await getFields();
    const refs = findUnknownFields(view.state.doc.toString(), bodyRef, fields);
    return toDiagnostics(refs, 0);
  });
}

export function buildEditorExtensions(
  getFields: (index?: string) => Promise<FlatField[]>,
  getFieldValues: (index: string | undefined, field: string) => Promise<string[]>,
  lintEnabled: boolean,
): Extension[] {
  return [
    json(),
    autocompletion({ override: [esCompletionSource(getFields, getFieldValues)] }),
    activeBlockHighlight(),
    ...(lintEnabled ? [restLinter(getFields)] : []),
  ];
}
