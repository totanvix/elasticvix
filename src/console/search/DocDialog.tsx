import { useMemo } from 'react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import type { Hit } from './hitsLib';

type Props = {
  hit?: Hit;
  onClose: () => void;
};

export function DocDialog({ hit, onClose }: Props) {
  const pretty = useMemo(() => (hit ? JSON.stringify(hit, null, 2) : ''), [hit]);

  return (
    <Dialog
      open={hit !== undefined}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="truncate">
            {hit?._index} / {hit?._id}
          </DialogTitle>
        </DialogHeader>
        <pre className="max-h-[60vh] overflow-auto rounded-md bg-muted p-3 font-mono text-xs">{pretty}</pre>
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(pretty)}>
            Copy
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
