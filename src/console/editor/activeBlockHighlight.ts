import { RangeSetBuilder, type Extension } from '@codemirror/state';
import {
  Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate,
} from '@codemirror/view';
import { activeBlockRange, splitBlocks } from '../../lib/autocomplete/requestBlocks';

const activeLine = Decoration.line({ class: 'cm-activeRequestBlock' });

function buildDecorations(view: EditorView): DecorationSet {
  const doc = view.state.doc;
  const blocks = splitBlocks(doc.toString());
  if (blocks.length < 2) return Decoration.none; // a single request needs no marker
  const range = activeBlockRange(blocks, view.state.selection.main.head);
  if (!range) return Decoration.none;

  const builder = new RangeSetBuilder<Decoration>();
  const lastLine = doc.lineAt(Math.min(range.to, doc.length)).number;
  for (let n = doc.lineAt(range.from).number; n <= lastLine; n++) {
    const line = doc.line(n);
    builder.add(line.from, line.from, activeLine);
  }
  return builder.finish();
}

// Inset box-shadow instead of a border so the marker adds no layout shift.
const theme = EditorView.baseTheme({
  '.cm-activeRequestBlock': {
    boxShadow: 'inset 2px 0 0 var(--primary)',
    backgroundColor: 'color-mix(in srgb, var(--primary) 4%, transparent)',
  },
  '&dark .cm-activeRequestBlock': {
    backgroundColor: 'color-mix(in srgb, var(--primary) 7%, transparent)',
  },
});

// Marks every line of the request block Cmd+Enter / Run would execute.
export function activeBlockHighlight(): Extension {
  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = buildDecorations(view);
      }
      update(u: ViewUpdate) {
        if (u.docChanged || u.selectionSet) this.decorations = buildDecorations(u.view);
      }
    },
    { decorations: (v) => v.decorations },
  );
  return [plugin, theme];
}
