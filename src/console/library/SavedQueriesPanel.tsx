import { useCallback, useEffect, useMemo, useState } from 'react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import type { SavedQuery } from '../../lib/types';
import { listSavedQueries, searchSavedQueries, deleteSavedQuery } from '../../lib/storage/savedQueries';

type Props = {
  reloadKey: number;
  onLoad: (q: SavedQuery) => void;
};

export function SavedQueriesPanel({ reloadKey, onLoad }: Props) {
  const [all, setAll] = useState<SavedQuery[]>([]);
  const [text, setText] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [results, setResults] = useState<SavedQuery[]>([]);

  const reload = useCallback(async () => setAll(await listSavedQueries()), []);
  useEffect(() => {
    void reload();
  }, [reload, reloadKey]);
  useEffect(() => {
    void searchSavedQueries({ text, tags: activeTags }).then(setResults);
  }, [text, activeTags, all]);

  const allTags = useMemo(() => Array.from(new Set(all.flatMap((q) => q.tags))).sort(), [all]);
  const toggleTag = (t: string) =>
    setActiveTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  return (
    <div className="flex flex-col gap-2">
      <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search saved…" />
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
      <ul className="flex flex-col">
        {results.map((q) => (
          <li key={q.id} className="group flex items-center gap-1">
            <button
              className="flex-1 truncate rounded px-1 py-1 text-left text-sm hover:bg-accent"
              onClick={() => onLoad(q)}
              title={`${q.method} ${q.path}`}
            >
              {q.name}
            </button>
            <Button
              size="sm"
              variant="ghost"
              className="opacity-0 group-hover:opacity-100"
              onClick={() => void deleteSavedQuery(q.id).then(reload)}
            >
              ✕
            </Button>
          </li>
        ))}
        {results.length === 0 && <li className="px-1 py-2 text-sm text-muted-foreground">No saved queries</li>}
      </ul>
    </div>
  );
}
