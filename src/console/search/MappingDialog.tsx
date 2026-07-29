import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import type { Connection } from '../../lib/types';
import { useIndexMapping } from './useIndexMapping';
import { filterFields, sortFields, typeClass, type TypeClass } from './mappingViewLib';

type Props = {
  connection: Connection | undefined;
  index: string | undefined;
  onClose: () => void;
};

const BADGE_CLASS: Record<TypeClass, string> = {
  keyword: 'bg-teal-500/15 text-teal-700 dark:text-teal-300',
  text: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  date: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  number: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  boolean: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  other: 'bg-muted text-muted-foreground',
};

function splitPath(path: string): { parent: string; leaf: string } {
  const i = path.lastIndexOf('.');
  return i === -1 ? { parent: '', leaf: path } : { parent: path.slice(0, i + 1), leaf: path.slice(i + 1) };
}

export function MappingDialog({ connection, index, onClose }: Props) {
  const { fields, isLoading, error, reload } = useIndexMapping(connection, index);
  const [filter, setFilter] = useState('');
  const sorted = useMemo(() => sortFields(fields), [fields]);
  const visible = useMemo(() => filterFields(sorted, filter), [sorted, filter]);

  return (
    <Dialog
      open={index !== undefined}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="truncate font-mono">{index}</span>
            <span className="text-sm font-normal text-muted-foreground tabular-nums">{fields.length} fields</span>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-7 w-7"
              aria-label="Reload mapping"
              onClick={() => void reload()}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <Input
          placeholder="Filter fields…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-8"
        />

        <div className="max-h-[60vh] overflow-auto rounded-md border">
          {error ? (
            <div className="p-4 text-sm">
              <p className="text-destructive">{error}</p>
              <button type="button" className="mt-1 underline text-muted-foreground" onClick={() => void reload()}>
                Retry
              </button>
            </div>
          ) : isLoading && fields.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              {fields.length === 0 ? 'No fields.' : 'No fields match the filter.'}
            </p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">Field</th>
                  <th className="px-3 py-2 text-left font-medium">Type</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((f) => {
                  const { parent, leaf } = splitPath(f.path);
                  return (
                    <tr key={f.path} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="px-3 py-1.5 font-mono text-xs">
                        <span className="text-muted-foreground">{parent}</span>
                        {leaf}
                      </td>
                      <td className="px-3 py-1.5">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 font-mono text-xs ${BADGE_CLASS[typeClass(f.type)]}`}
                        >
                          {f.type}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
