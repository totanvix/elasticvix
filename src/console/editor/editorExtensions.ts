import { json } from '@codemirror/lang-json';
import { autocompletion } from '@codemirror/autocomplete';
import { linter, type Diagnostic } from '@codemirror/lint';
import type { Extension } from '@codemirror/state';
import type { FlatField } from '../../lib/types';
import { esCompletionSource } from '../../lib/autocomplete/engine';
import { findUnknownFields, type FieldRef } from '../../lib/autocomplete/lintFields';
import { spec as defaultSpec } from '../../lib/autocomplete/spec';
import { parseRequestLine } from '../../lib/autocomplete/requestLine';

// The document is `METHOD /path` on line 1 + a JSON body. We highlight with
// json() (good enough for the body) and drive field-aware completion via the
// engine's source, which parses only the body sub-range.

function toDiagnostics(refs: FieldRef[], offset: number, index?: string): Diagnostic[] {
  const where = index ? ` of ${index}` : '';
  return refs.map((r) => ({
    from: offset + r.from,
    to: offset + r.to,
    severity: 'warning' as const,
    message: `"${r.field}" is not in the cached mapping${where}`,
  }));
}

// REST console: request line on line 1, JSON body after. Skip linting when the
// endpoint has no body spec, or the target is multi/wildcard (`*`/`,`) — the
// mapping fetch only returns the first concrete index, so a partial mapping
// would flag valid fields.
function restLinter(getFields: (index?: string) => Promise<FlatField[]>): Extension {
  return linter(async (view): Promise<Diagnostic[]> => {
    const docText = view.state.doc.toString();
    const nl = docText.indexOf('\n');
    if (nl === -1) return [];
    const { index, endpoint } = parseRequestLine(docText.slice(0, nl));
    const bodyRef = endpoint ? defaultSpec.endpoints[endpoint]?.bodyRef : undefined;
    if (!bodyRef) return [];
    if (index && /[*,]/.test(index)) return [];
    const fields = await getFields(index);
    const bodyStart = nl + 1;
    const refs = findUnknownFields(docText.slice(bodyStart), bodyRef, fields);
    return toDiagnostics(refs, bodyStart, index);
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
    ...(lintEnabled ? [restLinter(getFields)] : []),
  ];
}
