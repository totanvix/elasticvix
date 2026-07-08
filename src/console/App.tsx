import { Moon, Sun } from 'lucide-react';
import { ThemeProvider, useTheme } from './theme';
import { ConsoleLayout } from './layout/ConsoleLayout';
import { Button } from './ui/button';
import { useConnections } from './connections/useConnections';
import { ConnectionSwitcher } from './connections/ConnectionSwitcher';

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
      editor={<div className="p-3 text-sm text-muted-foreground">Editor (Task 5)</div>}
      response={<div className="p-3 text-sm text-muted-foreground">Response (Task 6)</div>}
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
