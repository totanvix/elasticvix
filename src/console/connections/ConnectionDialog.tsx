import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import type { AuthConfig, Connection, EsMajor } from '../../lib/types';
import { newId } from '../ids';
import type { TestResult } from './useConnections';
import { initialAuthFields } from './authFields';

type Props = {
  isOpen: boolean;
  initial?: Connection;
  onOpenChange: (open: boolean) => void;
  onSave: (conn: Connection) => void;
  onTest: (conn: Connection) => Promise<TestResult>;
};

const AUTH_TYPES: AuthConfig['type'][] = ['none', 'basic', 'apiKey', 'bearer'];

export function ConnectionDialog({ isOpen, initial, onOpenChange, onSave, onTest }: Props) {
  // State initializes once per mount — callers must remount per open (key={conn?.id ?? 'new'}).
  const init = initialAuthFields(initial?.auth);
  const [name, setName] = useState(initial?.name ?? '');
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? 'http://localhost:9200');
  const [authType, setAuthType] = useState<AuthConfig['type']>(initial?.auth.type ?? 'none');
  const [username, setUsername] = useState(init.username);
  const [password, setPassword] = useState(init.password);
  const [secret, setSecret] = useState(init.secret);
  const [testMsg, setTestMsg] = useState('');
  const [detected, setDetected] = useState<{ version?: string; major?: EsMajor } | undefined>(undefined);

  const buildAuth = (): AuthConfig => {
    if (authType === 'basic') return { type: 'basic', username, password };
    if (authType === 'apiKey') return { type: 'apiKey', apiKey: secret };
    if (authType === 'bearer') return { type: 'bearer', token: secret };
    return { type: 'none' };
  };

  const buildConn = (): Connection => {
    const now = Date.now();
    return {
      id: initial?.id ?? newId(),
      name: name.trim() || baseUrl,
      baseUrl: baseUrl.replace(/\/$/, ''),
      auth: buildAuth(),
      version: detected?.version ?? initial?.version,
      major: detected?.major ?? initial?.major,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    };
  };

  const handleTest = async () => {
    setTestMsg('Testing…');
    const r = await onTest(buildConn());
    if (r.ok) setDetected({ version: r.version, major: r.major });
    setTestMsg(r.ok ? `OK — Elasticsearch ${r.version ?? '?'}` : `Failed — ${r.error}`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit connection' : 'Add connection'}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="c-name">Name</Label>
            <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="c-url">Base URL</Label>
            <Input id="c-url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://host:9200" />
          </div>
          <div className="grid gap-1.5">
            <Label>Auth</Label>
            <Select value={authType} onValueChange={(v) => setAuthType(v as AuthConfig['type'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUTH_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {authType === 'basic' && (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="c-user">Username</Label>
                <Input id="c-user" value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="c-pass">Password</Label>
                <Input id="c-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </>
          )}
          {(authType === 'apiKey' || authType === 'bearer') && (
            <div className="grid gap-1.5">
              <Label htmlFor="c-secret">{authType === 'apiKey' ? 'API key' : 'Token'}</Label>
              <Input id="c-secret" value={secret} onChange={(e) => setSecret(e.target.value)} />
            </div>
          )}
          {testMsg && <p className="text-sm text-muted-foreground">{testMsg}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleTest}>
              Test
            </Button>
            <Button
              onClick={() => {
                onSave(buildConn());
                onOpenChange(false);
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
