import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cellText, deriveColumns, filterHits, sortHits, type Hit, type SortDir } from './hitsLib';
import type { TotalInfo } from './searchLib';
import { PAGE_SIZES } from './useSearch';
import { useHiddenColumns } from './useHiddenColumns';
import { ColumnsMenu } from './ColumnsMenu';

type Props = {
  hits: Hit[];
  hasMultipleIndices: boolean;
  connectionId: string;
  total?: TotalInfo;
  page: number;
  size: number;
  isRunning: boolean;
  onPageChange: (page: number) => void;
  onSizeChange: (size: number) => void;
  onRowClick: (hit: Hit) => void;
};

type Sort = { column: string; dir: SortDir };

export function HitsTable({
  hits,
  hasMultipleIndices,
  connectionId,
  total,
  page,
  size,
  isRunning,
  onPageChange,
  onSizeChange,
  onRowClick,
}: Props) {
  const [sort, setSort] = useState<Sort | undefined>(undefined);
  const [filter, setFilter] = useState('');
  const { hidden, toggle, showAll } = useHiddenColumns(connectionId);

  const columns = useMemo(() => deriveColumns(hits, hasMultipleIndices), [hits, hasMultipleIndices]);
  const visibleColumns = useMemo(() => columns.filter((c) => !hidden.has(c)), [columns, hidden]);
  const rows = useMemo(() => {
    const filtered = filterHits(hits, visibleColumns, filter);
    return sort ? sortHits(filtered, sort.column, sort.dir) : filtered;
  }, [hits, visibleColumns, filter, sort]);

  const handleSort = (column: string) => {
    setSort((prev) =>
      prev?.column === column ? { column, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { column, dir: 'asc' },
    );
  };

  if (hits.length === 0) {
    return <div className="p-4 text-sm text-muted-foreground">No results.</div>;
  }

  const from = (page - 1) * size;
  const lastPage = total ? Math.max(1, Math.ceil(total.value / size)) : page;
  const totalLabel = total ? `${total.value}${total.isGte ? '+' : ''}` : '?';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-end gap-2 border-b px-2 py-1.5">
        <ColumnsMenu columns={columns} hidden={hidden} onToggle={toggle} onShowAll={showAll} />
        <Input
          placeholder="Filter current page…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-8 w-64"
        />
      </div>
      {visibleColumns.length === 0 ? (
        <div className="min-h-0 flex-1 p-4 text-sm text-muted-foreground">
          All columns hidden. Use “Columns” to show them again.
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background">
              <tr className="border-b text-left">
                {visibleColumns.map((c) => (
                  <th key={c} className="whitespace-nowrap px-2 py-1.5 font-medium">
                    <button type="button" className="hover:text-primary" onClick={() => handleSort(c)}>
                      {c}
                      {sort?.column === c && <span> {sort.dir === 'asc' ? '↑' : '↓'}</span>}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((h, i) => (
                <tr
                  key={`${h._index ?? ''}-${h._id ?? i}`}
                  className="cursor-pointer border-b hover:bg-accent/50"
                  onClick={() => onRowClick(h)}
                >
                  {visibleColumns.map((c) => (
                    <td key={c} className="max-w-64 truncate px-2 py-1.5" title={cellText(h, c)}>
                      {cellText(h, c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="p-3 text-sm text-muted-foreground">No rows match the filter.</p>}
        </div>
      )}
      <div className="flex items-center justify-end gap-3 border-t px-2 py-1.5 text-sm tabular-nums">
        <span className="text-muted-foreground">Rows per page</span>
        <Select value={String(size)} onValueChange={(v) => onSizeChange(Number(v))}>
          <SelectTrigger className="h-7 w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((s) => (
              <SelectItem key={s} value={String(s)}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span>
          {from + 1}–{from + rows.length} of {totalLabel}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={isRunning || page <= 1}
          aria-label="Previous page"
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={isRunning || page >= lastPage}
          aria-label="Next page"
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
