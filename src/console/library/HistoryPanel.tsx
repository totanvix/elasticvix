import { useEffect, useState } from 'react';
import type { HistoryEntry } from '../../lib/types';
import { listHistory } from '../../lib/storage/history';

type Props = {
  reloadKey: number;
  onLoad: (entry: HistoryEntry) => void;
};

export function HistoryPanel({ reloadKey, onLoad }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  useEffect(() => {
    void listHistory().then(setEntries);
  }, [reloadKey]);

  return (
    <ul className="flex flex-col">
      {entries.map((e) => (
        <li key={e.id}>
          <button
            className="flex w-full items-center gap-2 rounded px-1 py-1 text-left text-sm hover:bg-accent"
            onClick={() => onLoad(e)}
          >
            <span className="font-mono text-xs text-muted-foreground">{e.method}</span>
            <span className="flex-1 truncate">{e.path}</span>
            {e.status != null && <span className="text-xs text-muted-foreground">{e.status}</span>}
          </button>
        </li>
      ))}
      {entries.length === 0 && <li className="px-1 py-2 text-sm text-muted-foreground">No history yet</li>}
    </ul>
  );
}
