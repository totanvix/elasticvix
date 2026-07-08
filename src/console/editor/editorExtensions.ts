import { json } from '@codemirror/lang-json';
import { autocompletion } from '@codemirror/autocomplete';
import type { Extension } from '@codemirror/state';
import type { FlatField } from '../../lib/types';
import { esCompletionSource } from '../../lib/autocomplete/engine';

// The document is `METHOD /path` on line 1 + a JSON body. We highlight with
// json() (good enough for the body) and drive field-aware completion via the
// engine's source, which parses only the body sub-range.
export function buildEditorExtensions(getFields: (index?: string) => Promise<FlatField[]>): Extension[] {
  return [json(), autocompletion({ override: [esCompletionSource(getFields)] })];
}
