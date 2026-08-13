import { useEffect, useState } from 'react';
import type { Connection } from '../../lib/types';
import { ClusterSelector } from '../connections/ClusterSelector';
import { SettingsMenu } from '../settings/SettingsMenu';
import { ConnectionStatusChip } from '../connections/ConnectionStatusChip';
import { useConnectionStatus } from '../connections/useConnectionStatus';
import type { TestResult } from '../connections/useConnections';
import { WhatsNewDialog } from '../changelog/WhatsNewDialog';
import { hasUnseenRelease, loadLastSeenVersion, saveLastSeenVersion, seedLastSeenVersion } from '../changelog/changelogLib';

export type ConsoleView = 'cluster' | 'search' | 'rest';

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
  { view: 'cluster', label: 'CLUSTER' },
  { view: 'search', label: 'SEARCH' },
  { view: 'rest', label: 'REST' },
];

export function TopNav({ view, onViewChange, connections, active, onSelect, onSave, onDelete, onTest }: Props) {
  const status = useConnectionStatus(active);
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

  const openWhatsNew = () => {
    saveLastSeenVersion(version);
    setLastSeen(version);
    setWhatsNewOpen(true);
  };

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
      <SettingsMenu onWhatsNew={openWhatsNew} hasUnseenRelease={hasUnread} />
      {isWhatsNewOpen && (
        <WhatsNewDialog
          isOpen
          version={version}
          onOpenChange={(open) => {
            if (!open) setWhatsNewOpen(false);
          }}
        />
      )}
    </>
  );
}
