import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { ThemeProvider, useTheme } from './theme';
import { ConsoleLayout } from './layout/ConsoleLayout';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useConnections } from './connections/useConnections';
import { ConnectionSwitcher } from './connections/ConnectionSwitcher';
import { useConsoleRun } from './editor/useConsoleRun';
import { QueryEditor } from './editor/QueryEditor';
import { ResponseView } from './editor/ResponseView';
import { SaveQueryDialog } from './library/SaveQueryDialog';
import { SavedQueriesPanel } from './library/SavedQueriesPanel';
import { HistoryPanel } from './library/HistoryPanel';

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
      {theme === 'dark' ? <Sun /> : <Moon />}
    </Button>
  );
}

function ConsoleInner() {
  const conns = useConnections();
  const runner = useConsoleRun(conns.active);
  const [isSaveOpen, setSaveOpen] = useState(false);
  const [savedReloadKey, setSavedReloadKey] = useState(0);

  const loadIntoEditor = (r: { method: string; path: string; body: string }) => {
    runner.setText(`${r.method} ${r.path}\n${r.body}`);
  };

  return (
    <>
      <ConsoleLayout
        topBar={
          <>
            <span className="text-lg font-semibold">Elasticvix</span>
            <div className="ml-3">
              <ConnectionSwitcher
                connections={conns.connections}
                active={conns.active}
                onSelect={conns.setActive}
                onSave={conns.addOrUpdate}
                onTest={conns.test}
              />
            </div>
            <div className="ml-auto">
              <ThemeToggle />
            </div>
          </>
        }
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
