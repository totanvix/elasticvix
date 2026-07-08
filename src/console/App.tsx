import { Moon, Sun } from 'lucide-react';
import { ThemeProvider, useTheme } from './theme';
import { ConsoleLayout } from './layout/ConsoleLayout';
import { Button } from './ui/button';
import { useConnections } from './connections/useConnections';
import { ConnectionSwitcher } from './connections/ConnectionSwitcher';
import { useConsoleRun } from './editor/useConsoleRun';
import { QueryEditor } from './editor/QueryEditor';
import { ResponseView } from './editor/ResponseView';

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

  return (
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
      leftRail={<div className="p-3 text-sm text-muted-foreground">Saved / History (Task 7–8)</div>}
      editor={
        <QueryEditor
          active={conns.active}
          text={runner.text}
          onChange={runner.setText}
          onRun={runner.run}
          isRunning={runner.isRunning}
          onFormat={runner.format}
          onSave={() => {}}
        />
      }
      response={<ResponseView response={runner.response} />}
    />
  );
}

export function App() {
  return (
    <ThemeProvider>
      <ConsoleInner />
    </ThemeProvider>
  );
}
