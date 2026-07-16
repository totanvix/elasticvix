import { useCallback, useEffect, useMemo, useState } from 'react';
import { Star } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import type { SearchSavedQuery } from '../../lib/types';
import {
  listSearchSavedQueries,
  searchSearchSavedQueries,
  deleteSearchSavedQuery,
} from '../../lib/storage/searchSavedQueries';

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

  const handleLoad = (q: SearchSavedQuery) => {
    onLoad(q);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Star className="h-4 w-4" /> Saved
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-2" align="end">
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
              <li key={q.id} className="group flex items-center gap-1">
                <button
                  className="flex-1 truncate rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                  onClick={() => handleLoad(q)}
                  title={q.indices.join(', ')}
                >
                  {q.name}
                </button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="opacity-0 group-hover:opacity-100"
                  onClick={() => void deleteSearchSavedQuery(q.id).then(reload)}
                >
                  ✕
                </Button>
              </li>
            ))}
            {results.length === 0 && <li className="px-2 py-2 text-sm text-muted-foreground">No saved queries</li>}
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  );
}
