import { useCallback, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import type { Connection, FlatField } from '../../lib/types';
import { makeGetFields } from '../editor/getFields';
import { ConnectionDialog } from '../connections/ConnectionDialog';
import type { TestResult } from '../connections/useConnections';
import { esErrorReason, unionFields } from './searchLib';
import { extractHits, type Hit } from './hitsLib';
import { useIndices } from './useIndices';
import { DEFAULT_QUERY, useSearch } from './useSearch';
import { IndicesSelect } from './IndicesSelect';
import { SearchEditor } from './SearchEditor';
import { HitsTable } from './HitsTable';
import { DocDialog } from './DocDialog';
import { AggregationsView } from './AggregationsView';
import { downloadJson, searchDownloadName } from './downloadJson';

type Props = {
  active: Connection | undefined;
  onSaveConnection: (conn: Connection) => void;
  onTestConnection: (conn: Connection) => Promise<TestResult>;
};

export function SearchPage({ active, onSaveConnection, onTestConnection }: Props) {
  const indicesState = useIndices(active);
  const search = useSearch(active);
  const [openHit, setOpenHit] = useState<Hit | undefined>(undefined);
  const [isAddOpen, setAddOpen] = useState(false);

  const getFields = useCallback(async (): Promise<FlatField[]> => {
    if (!active || search.selected.length === 0) return [];
    const perIndex = makeGetFields(active);
    const lists = await Promise.all(search.selected.map((index) => perIndex(index)));
    return unionFields(lists);
  }, [active, search.selected]);

  if (!active) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <p>No Elasticsearch connection yet.</p>
        <Button onClick={() => setAddOpen(true)}>Add connection</Button>
        {isAddOpen && (
          <ConnectionDialog
            key="new"
            isOpen
            onOpenChange={(open) => {
              if (!open) setAddOpen(false);
            }}
            onSave={onSaveConnection}
            onTest={onTestConnection}
          />
        )}
      </div>
    );
  }

  const hits = extractHits(search.response?.body);
  const isEsError = search.response !== undefined && (search.response.status === 0 || search.response.status >= 400);
  const errorHeadline = isEsError
    ? search.response?.error ?? esErrorReason(search.response?.body) ?? `HTTP ${search.response?.status}`
    : undefined;
  const hasResults = search.response !== undefined && !isEsError;
  const canSearch = search.selected.length > 0 && !search.isRunning;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <IndicesSelect
          indices={indicesState.indices}
          selected={search.selected}
          isLoading={indicesState.isLoading}
          error={indicesState.error}
          onChange={search.selectIndices}
          onReload={() => void indicesState.reload()}
        />
        <Button onClick={() => void search.runSearch()} disabled={!canSearch}>
          {search.isRunning ? 'Searching…' : 'Search'}
        </Button>
        {search.selected.length === 0 && <span className="text-sm text-muted-foreground">Select at least 1 index</span>}
        {hasResults && <span className="text-sm text-muted-foreground tabular-nums">{search.response?.took} ms</span>}
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => search.changeQuery(DEFAULT_QUERY)}>
            Reset query
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={search.response === undefined}
            onClick={() => downloadJson(search.response?.body, searchDownloadName(new Date()))}
          >
            <Download className="h-4 w-4" /> JSON
          </Button>
        </div>
      </div>

      <div className="h-48 shrink-0 overflow-hidden rounded-md border">
        <SearchEditor
          value={search.queryText}
          onChange={search.changeQuery}
          onRun={() => void search.runSearch()}
          getFields={getFields}
        />
      </div>

      {(search.inputError ?? errorHeadline) && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm">
          <p className="font-medium text-destructive">{search.inputError ?? errorHeadline}</p>
          {isEsError && search.response && (
            <details className="mt-1">
              <summary className="cursor-pointer text-muted-foreground">Raw error</summary>
              <pre className="mt-1 max-h-48 overflow-auto font-mono text-xs">
                {JSON.stringify(search.response.body, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}

      <Tabs defaultValue="hits" className="flex min-h-0 flex-1 flex-col">
        <TabsList>
          <TabsTrigger value="hits">Hits</TabsTrigger>
          <TabsTrigger value="aggregations">Aggregations</TabsTrigger>
        </TabsList>
        <TabsContent value="hits" className="min-h-0 flex-1 overflow-hidden rounded-md border">
          {hasResults ? (
            <HitsTable
              hits={hits}
              hasMultipleIndices={search.selected.length > 1}
              total={search.total}
              page={search.page}
              size={search.size}
              isRunning={search.isRunning}
              onPageChange={(p) => void search.goToPage(p)}
              onSizeChange={(s) => void search.changeSize(s)}
              onRowClick={setOpenHit}
            />
          ) : (
            <div className="p-4 text-sm text-muted-foreground">Run a search to see results.</div>
          )}
        </TabsContent>
        <TabsContent value="aggregations" className="min-h-0 flex-1 overflow-auto rounded-md border">
          {hasResults ? (
            <AggregationsView responseBody={search.response?.body} />
          ) : (
            <div className="p-4 text-sm text-muted-foreground">Run a search to see aggregations.</div>
          )}
        </TabsContent>
      </Tabs>

      <DocDialog hit={openHit} onClose={() => setOpenHit(undefined)} />
    </div>
  );
}
