import { useCallback, useEffect, useMemo, useState } from 'react';
import { Star, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import type { SearchSavedQuery } from '../../lib/types';
import {
  listSearchSavedQueries,
  searchSearchSavedQueries,
  deleteSearchSavedQuery,
} from '../../lib/storage/searchSavedQueries';
import { formatRelativeTime } from './relativeTime';

type Props = {
  reloadKey: number;
  onLoad: (q: SearchSavedQuery) => void;
};

export function SearchSavedPopover({ reloadKey, onLoad }: Props) {
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState<SearchSavedQuery[]>([]);
  const [text, setText] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [results, setResults] = useState<SearchSavedQuery[]>([]);
  const [confirmingId, setConfirmingId] = useState<string | undefined>(undefined);

  const reload = useCallback(async () => setAll(await listSearchSavedQueries()), []);
  useEffect(() => {
    void reload();
  }, [reload, reloadKey, open]);
  useEffect(() => {
    void searchSearchSavedQueries({ text, tags: activeTags }).then(setResults);
  }, [text, activeTags, all]);

  const allTags = useMemo(() => Array.from(new Set(all.flatMap((q) => q.tags))).sort(), [all]);
  const toggleTag = (t: string) =>
    setActiveTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setConfirmingId(undefined);
  };

  const handleLoad = (q: SearchSavedQuery) => {
    onLoad(q);
    setOpen(false);
  };

  const handleDelete = (id: string) => {
    setConfirmingId(undefined);
    void deleteSearchSavedQuery(id).then(reload);
  };

  const now = Date.now();

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Star className="h-4 w-4" /> Saved
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-2" align="end">
        {all.length === 0 ? (
          <div className="flex flex-col items-center gap-1 py-6 text-center">
            <Star className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No saved queries yet</p>
            <p className="text-xs text-muted-foreground">Save a search to reuse it later.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search saved…" className="h-8" />
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {allTags.map((t) => (
                  <button
                    key={t}
                    onClick={() => toggleTag(t)}
                    className={`rounded-full border px-2 py-0.5 text-xs ${
                      activeTags.includes(t) ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    #{t}
                  </button>
                ))}
              </div>
            )}
            <ul className="flex max-h-72 flex-col overflow-y-auto">
              {results.map((q) => (
                <li key={q.id} className="group flex items-center gap-1 rounded-sm px-2 py-1.5 hover:bg-accent">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
                    onClick={() => handleLoad(q)}
                  >
                    <span className="truncate text-sm">{q.name}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="min-w-0 truncate">{q.indices.join(', ')}</span>
                      <span className="shrink-0">{formatRelativeTime(now, q.updatedAt)}</span>
                    </span>
                  </button>
                  {confirmingId === q.id ? (
                    <Button variant="destructive" size="sm" className="h-6 px-2 text-xs" onClick={() => handleDelete(q.id)}>
                      Delete?
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      aria-label="Delete saved query"
                      onClick={() => setConfirmingId(q.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </li>
              ))}
              {results.length === 0 && (
                <li className="px-2 py-4 text-center">
                  <p className="text-sm text-muted-foreground">No matches</p>
                  <p className="text-xs text-muted-foreground">Try a different search or tag.</p>
                </li>
              )}
            </ul>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
