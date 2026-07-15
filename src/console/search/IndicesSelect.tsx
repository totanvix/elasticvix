import { useState } from 'react';
import { ChevronDown, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import type { IndexInfo } from './indicesLib';

type Props = {
  indices: IndexInfo[];
  selected: string[];
  isLoading: boolean;
  error?: string;
  onChange: (selected: string[]) => void;
  onReload: () => void;
};

function triggerLabel(selected: string[]): string {
  if (selected.length === 0) return 'Select indices';
  if (selected.length === 1) return selected[0]!;
  return `${selected[0]!} +${selected.length - 1}`;
}

export function IndicesSelect({ indices, selected, isLoading, error, onChange, onReload }: Props) {
  const [filter, setFilter] = useState('');
  const visible = indices.filter((i) => i.index.toLowerCase().includes(filter.trim().toLowerCase()));

  const toggle = (name: string, isChecked: boolean) => {
    onChange(isChecked ? [...selected, name] : selected.filter((s) => s !== name));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-72 justify-between">
          <span className="truncate">{triggerLabel(selected)}</span>
          <ChevronDown className="h-4 w-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2">
        <div className="flex items-center gap-1 pb-2">
          <Input placeholder="Filter indices…" value={filter} onChange={(e) => setFilter(e.target.value)} className="h-8" />
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Reload indices" onClick={onReload}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        {error && (
          <p className="px-1 pb-2 text-sm text-destructive">
            {error}{' '}
            <button type="button" className="underline" onClick={onReload}>
              Retry
            </button>
          </p>
        )}
        <div className="max-h-64 overflow-y-auto">
          {visible.map((i) => (
            <label
              key={i.index}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-1 text-sm hover:bg-accent"
            >
              <Checkbox checked={selected.includes(i.index)} onCheckedChange={(v) => toggle(i.index, v === true)} />
              <span className="flex-1 truncate">{i.index}</span>
              {i.docsCount && <span className="text-xs text-muted-foreground tabular-nums">{i.docsCount}</span>}
            </label>
          ))}
          {!error && visible.length === 0 && (
            <p className="px-1 py-2 text-sm text-muted-foreground">{isLoading ? 'Loading…' : 'No indices.'}</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
