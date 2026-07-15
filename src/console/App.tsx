import { useState } from 'react';
import { ThemeProvider } from './theme';
import { AppShell, RestPanes } from './layout/ConsoleLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useConnections } from './connections/useConnections';
import { useConsoleRun } from './editor/useConsoleRun';
import { QueryEditor } from './editor/QueryEditor';
import { ResponseView } from './editor/ResponseView';
import { SaveQueryDialog } from './library/SaveQueryDialog';
import { SavedQueriesPanel } from './library/SavedQueriesPanel';
import { HistoryPanel } from './library/HistoryPanel';
import { TopNav, type ConsoleView } from './nav/TopNav';
import { SearchPage } from './search/SearchPage';

const VIEW_KEY = 'elasticvix.view';

function loadView(): ConsoleView {
  return localStorage.getItem(VIEW_KEY) === 'rest' ? 'rest' : 'search';
}

function ConsoleInner() {
  const conns = useConnections();
  const runner = useConsoleRun(conns.active);
  const [view, setView] = useState<ConsoleView>(loadView);
  const [isSaveOpen, setSaveOpen] = useState(false);
  const [savedReloadKey, setSavedReloadKey] = useState(0);

  const handleViewChange = (next: ConsoleView) => {
    setView(next);
    localStorage.setItem(VIEW_KEY, next);
  };

  const loadIntoEditor = (r: { method: string; path: string; body: string }) => {
    runner.setText(`${r.method} ${r.path}\n${r.body}`);
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
          />
        }
      >
        {view === 'search' ? (
          <main className="min-w-0 flex-1 overflow-hidden">
            <SearchPage active={conns.active} onSaveConnection={conns.addOrUpdate} onTestConnection={conns.test} />
          </main>
        ) : (
          <RestPanes
            leftRail={
              <Tabs defaultValue="saved" className="h-full p-2">
                <TabsList>
                  <TabsTrigger value="saved">Saved</TabsTrigger>
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
                onFormat={runner.format}
                onSave={() => setSaveOpen(true)}
              />
            }
            response={<ResponseView response={runner.response} />}
          />
        )}
      </AppShell>
      <SaveQueryDialog
        isOpen={isSaveOpen}
        requestText={runner.text}
        connectionId={conns.active?.id}
        onOpenChange={setSaveOpen}
        onSaved={() => setSavedReloadKey((k) => k + 1)}
      />
    </>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <ConsoleInner />
    </ThemeProvider>
  );
}
