import { useCallback, useRef, useState } from 'react';
import type { Connection, HistoryEntry } from '../../lib/types';
import type { EsResult } from '../../lib/rpc/messages';
import { esRequest } from '../../lib/rpc/client';
import { splitBlocks, runnableBlockAt } from '../../lib/autocomplete/requestBlocks';
import { addHistory } from '../../lib/storage/history';
import { newId } from '../ids';
import { recordEngagementRun } from '../engagement/engagementStore';

const DEFAULT_TEXT = 'GET /_search\n{\n  "query": {\n    "match_all": {}\n  }\n}';

export function useConsoleRun(active: Connection | undefined) {
  const [text, setText] = useState<string>(DEFAULT_TEXT);
  const [response, setResponse] = useState<EsResult | undefined>(undefined);
  const [isRunning, setRunning] = useState(false);
  const [ranAt, setRanAt] = useState(0); // bump after each run so History can refresh

  // Read the text through a ref so `run` keeps a stable identity across
  // keystrokes — the editor's extension array depends on it staying put.
  const textRef = useRef(text);
  textRef.current = text;

  const run = useCallback(async (pos: number) => {
    if (!active) {
      setResponse({ status: 0, took: 0, body: null, error: 'No active connection' });
      return;
    }
    const block = runnableBlockAt(splitBlocks(textRef.current), pos);
    if (!block) {
      setResponse({ status: 0, took: 0, body: null, error: 'No request found — expected a METHOD /path line' });
      return;
    }
    const body = block.bodyText.trim() || undefined;
    setRunning(true);
    try {
      const result = await esRequest(active, block.method, block.path, body);
      setResponse(result);
      const entry: HistoryEntry = {
        id: newId(),
        method: block.method,
        path: block.path,
        body: body ?? '',
        connectionId: active.id,
        status: result.status,
        took: result.took,
        ranAt: Date.now(),
      };
      await addHistory(entry);
      setRanAt((n) => n + 1);
      recordEngagementRun();
    } finally {
      setRunning(false);
    }
  }, [active]);

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
