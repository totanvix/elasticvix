import { Moon, Sun } from 'lucide-react';
import { Button } from '../ui/button';
import { useTheme } from '../theme';
import type { Connection } from '../../lib/types';
import { ClusterSelector } from '../connections/ClusterSelector';
import { ConnectionStatusChip } from '../connections/ConnectionStatusChip';
import { useConnectionStatus } from '../connections/useConnectionStatus';
import type { TestResult } from '../connections/useConnections';

export type ConsoleView = 'search' | 'rest';

type Props = {
  view: ConsoleView;
  onViewChange: (view: ConsoleView) => void;
  connections: Connection[];
  active?: Connection;
  onSelect: (id: string) => void;
  onSave: (conn: Connection) => void;
  onDelete: (id: string) => void;
  onTest: (conn: Connection) => Promise<TestResult>;
};

const NAV_ITEMS: { view: ConsoleView; label: string }[] = [
  { view: 'search', label: 'SEARCH' },
  { view: 'rest', label: 'REST' },
];

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
      {theme === 'dark' ? <Sun /> : <Moon />}
    </Button>
  );
}

export function TopNav({ view, onViewChange, connections, active, onSelect, onSave, onDelete, onTest }: Props) {
  const status = useConnectionStatus(active);
  return (
    <>
      <span className="text-lg font-semibold">Elasticvix</span>
      <div className="ml-3">
        <ClusterSelector
          connections={connections}
          active={active}
          onSelect={onSelect}
          onSave={onSave}
          onDelete={onDelete}
          onTest={onTest}
        />
      </div>
      {active && (
        <div className="ml-3">
          <ConnectionStatusChip status={status} />
        </div>
      )}
      <nav className="ml-auto flex items-center gap-1">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.view}
            type="button"
            className={`border-b-2 px-3 py-2 text-sm font-medium tracking-wider ${
              view === item.view
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => onViewChange(item.view)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <ThemeToggle />
    </>
  );
}
