import { Columns3 } from 'lucide-react';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

type Props = {
  columns: string[];
  hidden: Set<string>;
  onToggle: (column: string) => void;
  onShowAll: () => void;
};

export function ColumnsMenu({ columns, hidden, onToggle, onShowAll }: Props) {
  const hiddenCount = columns.filter((c) => hidden.has(c)).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Columns3 className="h-4 w-4" /> Columns
          {hiddenCount > 0 && <span className="text-muted-foreground">· {hiddenCount} hidden</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60">
        <div className="mb-1 flex items-center justify-between px-1">
          <span className="text-xs font-medium text-muted-foreground">Columns</span>
          <button
            type="button"
            className="text-xs text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
            onClick={onShowAll}
            disabled={hiddenCount === 0}
          >
            Show all
          </button>
        </div>
        <div className="max-h-72 space-y-0.5 overflow-auto">
          {columns.map((c) => (
            <label
              key={c}
              className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-accent"
            >
              <Checkbox checked={!hidden.has(c)} onCheckedChange={() => onToggle(c)} />
              <span className="truncate text-sm">{c}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
