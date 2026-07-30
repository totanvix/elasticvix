import { useEffect, useMemo, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { EditorView } from '@codemirror/view';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import type { Connection } from '../../lib/types';
import { esRequest } from '../../lib/rpc/client';
import { useTheme } from '../theme';
import type { Hit } from './hitsLib';
import { esErrorReason } from './searchLib';
import {
  documentPath,
  writePath,
  extractDocMeta,
  parseEditableSource,
  type DocRef,
  type DocMeta,
} from './docWrite';

type Props = {
  hit?: Hit;
  connection: Connection;
  onClose: () => void;
  onChanged: (removed: boolean) => void;
};

type Mode = 'view' | 'edit' | 'confirmDelete';

const EDIT_EXTENSIONS = [json(), EditorView.lineWrapping];

function refOf(hit: Hit | undefined): DocRef | undefined {
  if (!hit || hit._index === undefined || hit._id === undefined) return undefined;
  return { index: hit._index, type: hit._type, id: hit._id };
}

function reason(res: { body: unknown; status: number; error?: string }): string {
  return res.error ?? esErrorReason(res.body) ?? `Request failed (status ${res.status})`;
}

export function DocDialog({ hit, connection, onClose, onChanged }: Props) {
  const { theme } = useTheme();
  const [mode, setMode] = useState<Mode>('view');
  const [meta, setMeta] = useState<DocMeta | undefined>(undefined);
  const [editText, setEditText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const ref = refOf(hit);
  const pretty = useMemo(() => (hit ? JSON.stringify(hit, null, 2) : ''), [hit]);

  // Reset to a clean view whenever a different hit opens the dialog.
  useEffect(() => {
    setMode('view');
    setMeta(undefined);
    setEditText('');
    setBusy(false);
    setError(undefined);
  }, [hit]);

  const parsed = useMemo(() => parseEditableSource(editText), [editText]);
  const editInvalid = mode === 'edit' && !parsed.ok;

  async function startEdit() {
    if (!ref) return;
    setBusy(true);
    setError(undefined);
    // Refetch the full document — the search query may have restricted _source,
    // so hit._source can be partial and must never be written back.
    const res = await esRequest(connection, 'GET', documentPath(ref));
    setBusy(false);
    if (res.status < 200 || res.status >= 300) {
      setError(reason(res));
      return;
    }
    const m = extractDocMeta(res.body);
    if (!m) {
      setError('Could not read the document.');
      return;
    }
    setMeta(m);
    setEditText(JSON.stringify(m.source, null, 2));
    setMode('edit');
  }

  async function save() {
    if (!ref || !parsed.ok) return;
    setBusy(true);
    setError(undefined);
    const path = writePath(documentPath(ref), {
      seqNo: meta?.seqNo,
      primaryTerm: meta?.primaryTerm,
    });
    const res = await esRequest(connection, 'PUT', path, JSON.stringify(parsed.value));
    setBusy(false);
    if (res.status >= 200 && res.status < 300) {
      onChanged(false);
      onClose();
      return;
    }
    setError(
      res.status === 409
        ? 'Document changed since you opened it — reopen and try again.'
        : reason(res),
    );
  }

  async function remove() {
    if (!ref) return;
    setBusy(true);
    setError(undefined);
    const res = await esRequest(connection, 'DELETE', writePath(documentPath(ref), {}));
    setBusy(false);
    if (res.status >= 200 && res.status < 300) {
      onChanged(true);
      onClose();
      return;
    }
    setError(reason(res));
  }

  return (
    <Dialog
      open={hit !== undefined}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="truncate">
            {hit?._index} / {hit?._id}
          </DialogTitle>
        </DialogHeader>

        {mode === 'edit' ? (
          <div className="max-h-[60vh] overflow-auto rounded-md border">
            <CodeMirror
              value={editText}
              editable={!busy}
              onChange={setEditText}
              extensions={EDIT_EXTENSIONS}
              theme={theme === 'dark' ? 'dark' : 'light'}
              height="100%"
            />
          </div>
        ) : (
          <pre className="max-h-[60vh] overflow-auto rounded-md bg-muted p-3 font-mono text-xs">{pretty}</pre>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {mode === 'confirmDelete' && (
          <p className="text-sm">
            Delete{' '}
            <span className="font-mono">
              {hit?._index}/{hit?._id}
            </span>
            ? This cannot be undone.
          </p>
        )}

        <div className="flex justify-end gap-2">
          {mode === 'view' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void navigator.clipboard.writeText(pretty)}
              >
                Copy
              </Button>
              <Button variant="outline" size="sm" disabled={!ref || busy} onClick={() => void startEdit()}>
                <Pencil className="h-4 w-4" /> Edit
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={!ref || busy}
                onClick={() => {
                  setError(undefined);
                  setMode('confirmDelete');
                }}
              >
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </>
          )}

          {mode === 'edit' && (
            <>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => setMode('view')}>
                Cancel
              </Button>
              <Button size="sm" disabled={busy || editInvalid} onClick={() => void save()}>
                {busy ? 'Saving…' : 'Save'}
              </Button>
            </>
          )}

          {mode === 'confirmDelete' && (
            <>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => setMode('view')}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" disabled={busy} onClick={() => void remove()}>
                {busy ? 'Deleting…' : 'Delete'}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
