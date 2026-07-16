import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import type { SearchHistoryEntry } from '../../lib/types';
import { listSearchHistory } from '../../lib/storage/searchHistory';

type Props = {
  reloadKey: number;
  onLoad: (entry: SearchHistoryEntry) => void;
};

function bodyPreview(body: string): string {
  return body.replace(/\s+/g, ' ').trim();
}

export function SearchHistoryPopover({ reloadKey, onLoad }: Props) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<SearchHistoryEntry[]>([]);

  useEffect(() => {
    void listSearchHistory().then(setEntries);
  }, [reloadKey, open]);

  const handleLoad = (entry: SearchHistoryEntry) => {
    onLoad(entry);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <History className="h-4 w-4" /> History
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-2" align="end">
        <ul className="flex max-h-80 flex-col overflow-y-auto">
          {entries.map((e) => (
            <li key={e.id}>
              <button
                className="flex w-full flex-col gap-0.5 rounded px-2 py-1.5 text-left hover:bg-accent"
                onClick={() => handleLoad(e)}
              >
                <span className="flex items-center gap-2">
                  <span className="flex-1 truncate text-sm font-medium">{e.indices.join(', ')}</span>
                  {e.took != null && <span className="text-xs text-muted-foreground tabular-nums">{e.took} ms</span>}
                  {e.status != null && <span className="text-xs text-muted-foreground">{e.status}</span>}
                </span>
                <span className="truncate font-mono text-xs text-muted-foreground">{bodyPreview(e.body)}</span>
              </button>
            </li>
          ))}
          {entries.length === 0 && <li className="px-2 py-2 text-sm text-muted-foreground">No history yet</li>}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
