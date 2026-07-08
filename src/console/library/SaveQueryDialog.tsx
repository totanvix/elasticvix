import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import type { SavedQuery } from '../../lib/types';
import { parseRequestLine } from '../../lib/autocomplete/requestLine';
import { putSavedQuery } from '../../lib/storage/savedQueries';
import { newId } from '../ids';

type Props = {
  isOpen: boolean;
  requestText: string;
  connectionId?: string;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

export function SaveQueryDialog({ isOpen, requestText, connectionId, onOpenChange, onSaved }: Props) {
  const [name, setName] = useState('');
  const [tagsText, setTagsText] = useState('');

  const handleSave = async () => {
    const nl = requestText.indexOf('\n');
    const firstLine = nl === -1 ? requestText : requestText.slice(0, nl);
    const { method, path } = parseRequestLine(firstLine);
    const body = nl === -1 ? '' : requestText.slice(nl + 1);
    const now = Date.now();
    const q: SavedQuery = {
      id: newId(),
      name: name.trim() || `${method} ${path}`,
      tags: tagsText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      method,
      path,
      body,
      connectionId,
      createdAt: now,
      updatedAt: now,
    };
    await putSavedQuery(q);
    setName('');
    setTagsText('');
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save query</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="q-name">Name</Label>
            <Input id="q-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="q-tags">Tags (comma-separated)</Label>
            <Input id="q-tags" value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="prod, slow" />
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={handleSave}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
