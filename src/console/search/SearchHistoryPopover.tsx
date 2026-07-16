import { useCallback, useEffect, useState } from 'react';
import { History, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import type { SearchHistoryEntry } from '../../lib/types';
import { listSearchHistory, deleteSearchHistory, clearSearchHistory } from '../../lib/storage/searchHistory';
import { formatRelativeTime } from './relativeTime';

type Props = {
  reloadKey: number;
  onLoad: (entry: SearchHistoryEntry) => void;
};

function bodyPreview(body: string): string {
  return body.replace(/\s+/g, ' ').trim();
}

function statusBadgeClass(status: number): string {
  return status >= 200 && status < 300
    ? 'bg-green-500/15 text-green-600 dark:text-green-400'
    : 'bg-destructive/15 text-destructive';
}

export function SearchHistoryPopover({ reloadKey, onLoad }: Props) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<SearchHistoryEntry[]>([]);
  const [isConfirmingClear, setConfirmingClear] = useState(false);

  const reload = useCallback(async () => setEntries(await listSearchHistory()), []);
  useEffect(() => {
    void reload();
  }, [reload, reloadKey, open]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setConfirmingClear(false);
  };

  const handleLoad = (entry: SearchHistoryEntry) => {
    onLoad(entry);
    setOpen(false);
  };

  const handleClearAll = async () => {
    await clearSearchHistory();
    setEntries([]);
    setConfirmingClear(false);
  };

  const now = Date.now();

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <History className="h-4 w-4" /> History
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-2" align="end">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center gap-1 py-6 text-center">
            <History className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No history yet</p>
            <p className="text-xs text-muted-foreground">Run a search and it will show up here.</p>
          </div>
        ) : (
          <>
            <ul className="flex max-h-80 flex-col overflow-y-auto">
              {entries.map((e) => (
                <li key={e.id} className="group flex items-start gap-1 rounded-sm px-2 py-1.5 hover:bg-accent">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
                    onClick={() => handleLoad(e)}
                  >
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{e.indices.join(', ')}</span>
                      {e.status != null && (
                        <span className={`rounded px-1.5 text-xs tabular-nums ${statusBadgeClass(e.status)}`}>
                          {e.status}
                        </span>
                      )}
                      {e.took != null && <span className="text-xs text-muted-foreground tabular-nums">{e.took} ms</span>}
                    </span>
                    <span className="truncate font-mono text-xs text-muted-foreground">{bodyPreview(e.body)}</span>
                    <span className="text-xs text-muted-foreground">{formatRelativeTime(now, e.ranAt)}</span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    aria-label="Delete history entry"
                    onClick={() => void deleteSearchHistory(e.id).then(reload)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
            <div className="mt-1 border-t pt-1">
              {isConfirmingClear ? (
                <Button variant="destructive" size="sm" className="w-full" onClick={() => void handleClearAll()}>
                  Clear all history?
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-muted-foreground"
                  onClick={() => setConfirmingClear(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Clear all
                </Button>
              )}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
