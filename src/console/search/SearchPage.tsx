import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Wand2, Save } from 'lucide-react';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import type { Connection, FlatField } from '../../lib/types';
import { makeGetFields } from '../editor/getFields';
import { ResponseView } from '../editor/ResponseView';
import { ConnectionDialog } from '../connections/ConnectionDialog';
import type { TestResult } from '../connections/useConnections';
import { esErrorReason, unionFields } from './searchLib';
import { extractHits, type Hit } from './hitsLib';
import { largestIndex } from './indicesLib';
import { useIndices } from './useIndices';
import { DEFAULT_QUERY, useSearch } from './useSearch';
import { IndicesSelect } from './IndicesSelect';
import { SearchEditor } from './SearchEditor';
import { EditorResizeHandle, MIN_EDITOR_HEIGHT } from './EditorResizeHandle';
import { HitsTable } from './HitsTable';
import { DocDialog } from './DocDialog';
import { SaveSearchDialog } from './SaveSearchDialog';
import { SearchHistoryPopover } from './SearchHistoryPopover';
import { SearchSavedPopover } from './SearchSavedPopover';
import { downloadJson, searchDownloadName } from './downloadJson';

type Props = {
  active: Connection | undefined;
  onSaveConnection: (conn: Connection) => void;
  onTestConnection: (conn: Connection) => Promise<TestResult>;
};

const EDITOR_HEIGHT_KEY = 'elasticvix.search.editorHeight';
const DEFAULT_EDITOR_HEIGHT = 192;

function loadEditorHeight(): number {
  const n = Number(localStorage.getItem(EDITOR_HEIGHT_KEY));
  return Number.isFinite(n) && n >= MIN_EDITOR_HEIGHT ? n : DEFAULT_EDITOR_HEIGHT;
}

export function SearchPage({ active, onSaveConnection, onTestConnection }: Props) {
  const indicesState = useIndices(active);
  const search = useSearch(active);
  const [openHit, setOpenHit] = useState<Hit | undefined>(undefined);
  const [isAddOpen, setAddOpen] = useState(false);
  const [isSaveOpen, setSaveOpen] = useState(false);
  const [savedReloadKey, setSavedReloadKey] = useState(0);
  const [editorHeight, setEditorHeight] = useState(loadEditorHeight);

  const changeEditorHeight = useCallback((h: number) => {
    setEditorHeight(h);
    localStorage.setItem(EDITOR_HEIGHT_KEY, String(h));
  }, []);

  const getFields = useCallback(async (): Promise<FlatField[]> => {
    if (!active || search.selected.length === 0) return [];
    const perIndex = makeGetFields(active);
    const lists = await Promise.all(search.selected.map((index) => perIndex(index)));
    return unionFields(lists);
  }, [active, search.selected]);

  // Pre-select the largest index when the user hasn't chosen any, so Search works right away.
  // Decide once per connection and only after indices finish loading (so we never pick from the
  // previous connection's stale list), and never override a persisted/user selection.
  const autoSelectedFor = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!active || indicesState.isLoading || indicesState.indices.length === 0) return;
    if (autoSelectedFor.current === active.id) return;
    autoSelectedFor.current = active.id;
    if (search.selected.length > 0) return;
    const biggest = largestIndex(indicesState.indices);
    if (biggest) search.selectIndices([biggest]);
  }, [active, indicesState.isLoading, indicesState.indices, search.selected, search.selectIndices]);

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
          <SearchHistoryPopover reloadKey={search.ranAt} onLoad={search.load} />
          <SearchSavedPopover reloadKey={savedReloadKey} onLoad={search.load} />
          <Button variant="outline" size="sm" onClick={search.format}>
            <Wand2 className="h-4 w-4" /> Format
          </Button>
          <Button variant="outline" size="sm" disabled={search.selected.length === 0} onClick={() => setSaveOpen(true)}>
            <Save className="h-4 w-4" /> Save
          </Button>
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

      <div className="shrink-0">
        <div style={{ height: editorHeight }} className="overflow-hidden rounded-t-md border">
          <SearchEditor
            value={search.queryText}
            onChange={search.changeQuery}
            onRun={() => void search.runSearch()}
            getFields={getFields}
          />
        </div>
        <EditorResizeHandle height={editorHeight} onHeightChange={changeEditorHeight} />
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
          <TabsTrigger value="raw">Raw</TabsTrigger>
        </TabsList>
        <TabsContent value="hits" className="min-h-0 flex-1 overflow-hidden rounded-md border">
          {hasResults ? (
            <HitsTable
              hits={hits}
              hasMultipleIndices={search.selected.length > 1}
              connectionId={active.id}
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
        <TabsContent value="raw" className="min-h-0 flex-1 overflow-hidden rounded-md border">
          {search.response !== undefined ? (
            <ResponseView response={search.response} />
          ) : (
            <div className="p-4 text-sm text-muted-foreground">Run a search to see the raw response.</div>
          )}
        </TabsContent>
      </Tabs>

      <DocDialog hit={openHit} onClose={() => setOpenHit(undefined)} />
      <SaveSearchDialog
        isOpen={isSaveOpen}
        indices={search.selected}
        body={search.queryText}
        connectionId={active.id}
        onOpenChange={setSaveOpen}
        onSaved={() => setSavedReloadKey((k) => k + 1)}
      />
    </div>
  );
}
