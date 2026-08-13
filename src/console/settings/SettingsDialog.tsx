import { useRef, useState, type ChangeEvent } from 'react';
import { Download, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { applyImport, buildExport, parseExport, type ExportEnvelope } from '../../lib/storage/backup';
import { backupDownloadName, downloadJson } from '../search/downloadJson';

type Props = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

const RELOAD_DELAY_MS = 600;

export function SettingsDialog({ isOpen, onOpenChange }: Props) {
  const [includeCredentials, setIncludeCredentials] = useState(false);
  const [pending, setPending] = useState<ExportEnvelope | undefined>(undefined);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setStatusMsg('');
    setErrorMsg('');
    try {
      const envelope = await buildExport({ includeCredentials });
      downloadJson(envelope, backupDownloadName(new Date()));
    } catch (err) {
      setErrorMsg(`Export failed — ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setStatusMsg('');
    setErrorMsg('');
    setPending(undefined);
    const result = parseExport(await file.text());
    if (!result.ok) {
      setErrorMsg(result.error);
      return;
    }
    setPending(result.envelope);
  };

  const handleImport = async () => {
    if (!pending) return;
    try {
      const summary = await applyImport(pending);
      setPending(undefined);
      const queries = summary.savedQueries + summary.searchSavedQueries;
      setStatusMsg(`Imported ${summary.connections} connections and ${queries} saved queries. Reloading…`);
      setTimeout(() => location.reload(), RELOAD_DELAY_MS);
    } catch (err) {
      setErrorMsg(`Import failed — ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Backup &amp; restore</DialogTitle>
          <DialogDescription>Export connections and saved queries to a JSON file, or restore them.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Export</h3>
            <div className="flex items-center gap-2">
              <Checkbox
                id="include-credentials"
                checked={includeCredentials}
                onCheckedChange={(checked) => setIncludeCredentials(checked === true)}
              />
              <Label htmlFor="include-credentials">Include credentials</Label>
            </div>
            {includeCredentials ? (
              <p className="text-sm text-destructive">
                Passwords, API keys and tokens are written as plain text. Keep the file safe.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Credentials are left out — re-enter them after restoring on another machine.
              </p>
            )}
            <div>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download /> Export backup
              </Button>
            </div>
          </section>
          <section className="flex flex-col gap-2 border-t pt-4">
            <h3 className="text-sm font-medium">Import</h3>
            <p className="text-sm text-muted-foreground">
              Items with matching ids are overwritten; everything else is kept.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleFileChange}
            />
            <div>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload /> Choose file…
              </Button>
            </div>
            {errorMsg && (
              <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errorMsg}
              </p>
            )}
            {pending && (
              <div className="flex flex-col gap-2 rounded-md border p-3 text-sm">
                <p>
                  This file contains {pending.connections.length} connections, {pending.savedQueries.length} REST
                  queries and {pending.searchSavedQueries.length} search queries.
                </p>
                {!pending.includesCredentials && pending.connections.length > 0 && (
                  <p className="text-muted-foreground">
                    Credentials are not included — edit each imported connection to re-enter auth.
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPending(undefined)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleImport}>
                    Import
                  </Button>
                </div>
              </div>
            )}
            {statusMsg && <p className="text-sm text-muted-foreground">{statusMsg}</p>}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
