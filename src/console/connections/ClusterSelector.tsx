import { useState } from 'react';
import { ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import type { Connection } from '../../lib/types';
import { ConnectionDialog } from './ConnectionDialog';
import type { TestResult } from './useConnections';
import { useClusterHealth } from './useClusterHealth';
import { healthDotClass } from './health';

type DialogState = { mode: 'add' } | { mode: 'edit'; conn: Connection };

type Props = {
  connections: Connection[];
  active?: Connection;
  onSelect: (id: string) => void;
  onSave: (conn: Connection) => void;
  onDelete: (id: string) => void;
  onTest: (conn: Connection) => Promise<TestResult>;
};

export function ClusterSelector({ connections, active, onSelect, onSave, onDelete, onTest }: Props) {
  const [isOpen, setOpen] = useState(false);
  const [dialogState, setDialogState] = useState<DialogState | undefined>(undefined);
  const [confirmingId, setConfirmingId] = useState<string | undefined>(undefined);
  const { status, reason } = useClusterHealth(active);
  const dotTitle = reason ? `Cluster health unknown — ${reason}` : `Cluster health: ${status}`;

  const openDialog = (state: DialogState) => {
    setOpen(false);
    setConfirmingId(undefined);
    setDialogState(state);
  };

  const handleOpenChange = (open: boolean) => {
    setOpen(open);
    if (!open) setConfirmingId(undefined);
  };

  return (
    <>
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2" title={dotTitle}>
            <span className={`inline-block h-2 w-2 rounded-full ${healthDotClass(status)}`} />
            <span className="max-w-40 truncate">{active ? active.name : 'No connection'}</span>
            {active?.version && <span className="text-muted-foreground">· {active.version}</span>}
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-1">
          {connections.map((c) => (
            <div
              key={c.id}
              className={`flex items-center gap-1 rounded-sm px-2 py-1.5 text-sm hover:bg-accent ${
                c.id === active?.id ? 'bg-accent/50' : ''
              }`}
            >
              <button
                type="button"
                className="flex-1 truncate text-left"
                onClick={() => {
                  onSelect(c.id);
                  setOpen(false);
                }}
              >
                {c.name}
                {c.version && <span className="text-muted-foreground"> · {c.version}</span>}
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                aria-label={`Edit ${c.name}`}
                onClick={() => openDialog({ mode: 'edit', conn: c })}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              {confirmingId === c.id ? (
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => {
                    onDelete(c.id);
                    setConfirmingId(undefined);
                  }}
                >
                  Delete?
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  aria-label={`Delete ${c.name}`}
                  onClick={() => setConfirmingId(c.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
          {connections.length === 0 && <p className="px-2 py-1.5 text-sm text-muted-foreground">No connections yet.</p>}
          <div className="mt-1 border-t pt-1">
            <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => openDialog({ mode: 'add' })}>
              <Plus className="h-3.5 w-3.5" /> Add connection
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {dialogState && (
        <ConnectionDialog
          key={dialogState.mode === 'edit' ? dialogState.conn.id : 'new'}
          isOpen
          initial={dialogState.mode === 'edit' ? dialogState.conn : undefined}
          onOpenChange={(open) => {
            if (!open) setDialogState(undefined);
          }}
          onSave={onSave}
          onTest={onTest}
        />
      )}
    </>
  );
}
