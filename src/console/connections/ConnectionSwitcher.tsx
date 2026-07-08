import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Button } from '../ui/button';
import type { Connection } from '../../lib/types';
import { ConnectionDialog } from './ConnectionDialog';
import type { TestResult } from './useConnections';

type Props = {
  connections: Connection[];
  active?: Connection;
  onSelect: (id: string) => void;
  onSave: (conn: Connection) => void;
  onTest: (conn: Connection) => Promise<TestResult>;
};

export function ConnectionSwitcher({ connections, active, onSelect, onSave, onTest }: Props) {
  const [isDialogOpen, setDialogOpen] = useState(false);
  return (
    <div className="flex items-center gap-2">
      {connections.length > 0 ? (
        <Select value={active?.id ?? ''} onValueChange={onSelect}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Select cluster" />
          </SelectTrigger>
          <SelectContent>
            {connections.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
                {c.version ? ` · ${c.version}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <span className="text-sm text-muted-foreground">No connection</span>
      )}
      <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
        + Add
      </Button>
      <ConnectionDialog isOpen={isDialogOpen} onOpenChange={setDialogOpen} onSave={onSave} onTest={onTest} />
    </div>
  );
}
