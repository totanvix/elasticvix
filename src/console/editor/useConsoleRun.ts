import { useCallback, useState } from 'react';
import type { Connection, HistoryEntry } from '../../lib/types';
import type { EsResult } from '../../lib/rpc/messages';
import { esRequest } from '../../lib/rpc/client';
import { parseRequestLine } from '../../lib/autocomplete/requestLine';
import { addHistory } from '../../lib/storage/history';
import { newId } from '../ids';

const DEFAULT_TEXT = 'GET /_search\n{\n  "query": {\n    "match_all": {}\n  }\n}';

function splitRequest(text: string): { method: string; path: string; body?: string } {
  const nl = text.indexOf('\n');
  const firstLine = nl === -1 ? text : text.slice(0, nl);
  const { method, path } = parseRequestLine(firstLine);
  const body = nl === -1 ? '' : text.slice(nl + 1).trim();
  return { method, path, body: body || undefined };
}

export function useConsoleRun(active: Connection | undefined) {
  const [text, setText] = useState<string>(DEFAULT_TEXT);
  const [response, setResponse] = useState<EsResult | undefined>(undefined);
  const [isRunning, setRunning] = useState(false);
  const [ranAt, setRanAt] = useState(0); // bump after each run so History can refresh

  const run = useCallback(async () => {
    if (!active) {
      setResponse({ status: 0, took: 0, body: null, error: 'No active connection' });
      return;
    }
    const { method, path, body } = splitRequest(text);
    setRunning(true);
    try {
      const result = await esRequest(active, method, path, body);
      setResponse(result);
      const entry: HistoryEntry = {
        id: newId(),
        method,
        path,
        body: body ?? '',
        connectionId: active.id,
        status: result.status,
        took: result.took,
        ranAt: Date.now(),
      };
      await addHistory(entry);
      setRanAt((n) => n + 1);
    } finally {
      setRunning(false);
    }
  }, [active, text]);

  const format = useCallback(() => {
    const nl = text.indexOf('\n');
    if (nl === -1) return;
    const head = text.slice(0, nl);
    const body = text.slice(nl + 1).trim();
    try {
      setText(`${head}\n${JSON.stringify(JSON.parse(body), null, 2)}`);
    } catch {
      /* leave invalid JSON as-is */
    }
  }, [text]);

  return { text, setText, run, isRunning, response, format, ranAt };
}
