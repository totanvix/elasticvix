import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import type { SearchSavedQuery } from '../../lib/types';
import { putSearchSavedQuery } from '../../lib/storage/searchSavedQueries';
import { newId } from '../ids';

type Props = {
  isOpen: boolean;
  indices: string[];
  body: string;
  connectionId?: string;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

export function SaveSearchDialog({ isOpen, indices, body, connectionId, onOpenChange, onSaved }: Props) {
  const [name, setName] = useState('');
  const [tagsText, setTagsText] = useState('');

  const handleSave = async () => {
    const now = Date.now();
    const q: SearchSavedQuery = {
      id: newId(),
      name: name.trim() || indices.join(', ') || 'search',
      tags: tagsText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      indices,
      body,
      connectionId,
      createdAt: now,
      updatedAt: now,
    };
    await putSearchSavedQuery(q);
    setName('');
    setTagsText('');
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save search</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="s-name">Name</Label>
            <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="s-tags">Tags (comma-separated)</Label>
            <Input id="s-tags" value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="prod, slow" />
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={handleSave}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
