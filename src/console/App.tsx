import { useEffect, useRef, useState } from 'react';
import { ThemeProvider } from './theme';
import { TooltipProvider } from './ui/tooltip';
import { AppShell, RestPanes } from './layout/ConsoleLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { splitBlocks, runnableBlockAt } from '../lib/autocomplete/requestBlocks';
import { useConnections } from './connections/useConnections';
import { useConsoleRun } from './editor/useConsoleRun';
import { QueryEditor, type QueryEditorHandle } from './editor/QueryEditor';
import { ResponseView } from './editor/ResponseView';
import { SaveQueryDialog } from './library/SaveQueryDialog';
import { SavedQueriesPanel } from './library/SavedQueriesPanel';
import { HistoryPanel } from './library/HistoryPanel';
import { TopNav, type ConsoleView } from './nav/TopNav';
import { SearchPage } from './search/SearchPage';
import { ClusterPage } from './cluster/ClusterPage';
import { EngagementNudge } from './engagement/EngagementNudge';
import { WhatsNewDialog } from './changelog/WhatsNewDialog';
import { UpdateToast } from './changelog/UpdateToast';
import {
  hasUnseenRelease,
  loadLastSeenVersion,
  saveLastSeenVersion,
  seedLastSeenVersion,
} from './changelog/changelogLib';

const VIEW_KEY = 'elasticvix.view';

function loadView(): ConsoleView {
  const v = localStorage.getItem(VIEW_KEY);
  return v === 'search' || v === 'rest' ? v : 'cluster';
}

function ConsoleInner() {
  const conns = useConnections();
  const runner = useConsoleRun(conns.active);
  const [view, setView] = useState<ConsoleView>(loadView);
  const [isSaveOpen, setSaveOpen] = useState(false);
  const [savedReloadKey, setSavedReloadKey] = useState(0);
  const [saveRequest, setSaveRequest] = useState<{ method: string; path: string; body: string } | undefined>(undefined);
  const editorApi = useRef<QueryEditorHandle>(null);

  // Read inside the component: fakeBrowser throws on getManifest, so a module-scope
  // call would break any test that pulls this file into its module graph.
  const version = browser.runtime.getManifest().version;
  const [lastSeen, setLastSeen] = useState(loadLastSeenVersion);
  const [isWhatsNewOpen, setWhatsNewOpen] = useState(false);

  useEffect(() => {
    if (loadLastSeenVersion() === null) {
      seedLastSeenVersion(version);
      setLastSeen(version);
    }
  }, [version]);

  const hasUnread = hasUnseenRelease(lastSeen, version);

  const markSeen = () => {
    saveLastSeenVersion(version);
    setLastSeen(version);
  };

  const openWhatsNew = () => {
    markSeen();
    setWhatsNewOpen(true);
  };

  const handleViewChange = (next: ConsoleView) => {
    setView(next);
    localStorage.setItem(VIEW_KEY, next);
  };

  const loadIntoEditor = (r: { method: string; path: string; body: string }) => {
    editorApi.current?.appendRequest(r);
  };

  const handleSaveClick = (pos: number) => {
    const block = runnableBlockAt(splitBlocks(runner.text), pos);
    if (!block) return;
    setSaveRequest({ method: block.method, path: block.path, body: block.bodyText });
    setSaveOpen(true);
  };

  return (
    <>
      <AppShell
        topBar={
          <TopNav
            view={view}
            onViewChange={handleViewChange}
            connections={conns.connections}
            active={conns.active}
            onSelect={conns.setActive}
            onSave={conns.addOrUpdate}
            onDelete={conns.remove}
            onTest={conns.test}
            hasUnread={hasUnread}
            onWhatsNew={openWhatsNew}
          />
        }
      >
        {view === 'cluster' ? (
          <main className="min-w-0 flex-1 overflow-hidden">
            <ClusterPage active={conns.active} />
          </main>
        ) : view === 'search' ? (
          <main className="min-w-0 flex-1 overflow-hidden">
            <SearchPage active={conns.active} onSaveConnection={conns.addOrUpdate} onTestConnection={conns.test} />
          </main>
        ) : (
          <RestPanes
            leftRail={
              <Tabs defaultValue="saved" className="h-full p-2">
                <TabsList>
                  <TabsTrigger value="saved">Library</TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>
                <TabsContent value="saved" className="overflow-y-auto">
                  <SavedQueriesPanel reloadKey={savedReloadKey} onLoad={loadIntoEditor} />
                </TabsContent>
                <TabsContent value="history" className="overflow-y-auto">
                  <HistoryPanel reloadKey={runner.ranAt} onLoad={loadIntoEditor} />
                </TabsContent>
              </Tabs>
            }
            editor={
              <QueryEditor
                active={conns.active}
                text={runner.text}
                onChange={runner.setText}
                onRun={runner.run}
                isRunning={runner.isRunning}
                onSave={handleSaveClick}
                apiRef={editorApi}
              />
            }
            response={<ResponseView response={runner.response} />}
          />
        )}
      </AppShell>
      <SaveQueryDialog
        isOpen={isSaveOpen}
        request={saveRequest}
        connectionId={conns.active?.id}
        onOpenChange={setSaveOpen}
        onSaved={() => setSavedReloadKey((k) => k + 1)}
      />
      {isWhatsNewOpen && (
        <WhatsNewDialog
          isOpen
          version={version}
          onOpenChange={(open) => {
            if (!open) setWhatsNewOpen(false);
          }}
        />
      )}
      {hasUnread ? (
        <UpdateToast version={version} onSeeWhatsNew={openWhatsNew} onDismiss={markSeen} />
      ) : (
        <EngagementNudge />
      )}
    </>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <ConsoleInner />
      </TooltipProvider>
    </ThemeProvider>
  );
}
