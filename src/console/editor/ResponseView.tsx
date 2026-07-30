import { useMemo, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { EditorView, keymap } from '@codemirror/view';
import { codeFolding, foldGutter, foldKeymap } from '@codemirror/language';
import { Copy, Download } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import type { EsResult } from '../../lib/rpc/messages';
import { downloadJson, responseDownloadName } from '../search/downloadJson';
import { filterResponse } from './filterResponse';
import { useTheme } from '../theme';

type Props = { response: EsResult | undefined };

// Stable extension array: read-only JSON with wrapping + folding.
const EXTENSIONS = [json(), EditorView.lineWrapping, codeFolding(), foldGutter(), keymap.of(foldKeymap)];

function statusTone(status: number): string {
  if (status === 0) return 'bg-destructive'; // transport error
  if (status >= 200 && status < 300) return 'bg-green-500';
  return 'bg-amber-500'; // ES-level error (4xx/5xx)
}

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function ResponseView({ response }: Props) {
  const { theme } = useTheme();
  const [filter, setFilter] = useState('');

  const isTransportError = response?.status === 0 && Boolean(response?.error);
  const filterable = Boolean(response) && !isTransportError;

  // Displayed text obeys the filter (WYSIWYG): Copy/Download act on what is shown.
  const view = useMemo(() => {
    if (!response) return { text: '', noMatch: false, downloadValue: undefined as unknown };
    if (isTransportError) {
      return { text: `// Transport error\n${response.error}`, noMatch: false, downloadValue: undefined as unknown };
    }
    const q = filter.trim();
    const value = q === '' ? response.body : filterResponse(response.body, filter);
    if (q !== '' && value === undefined) return { text: '', noMatch: true, downloadValue: undefined as unknown };
    return { text: stringify(value), noMatch: false, downloadValue: value };
  }, [response, filter, isTransportError]);

  if (!response) {
    return <div className="p-3 text-sm text-muted-foreground">Run a request to see the response.</div>;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-2 py-1 text-sm">
        <span className={`inline-block h-2 w-2 rounded-full ${statusTone(response.status)}`} />
        <span>{response.status === 0 ? 'ERR' : response.status}</span>
        <span className="text-muted-foreground">· {response.took} ms</span>
        <div className="ml-auto flex items-center gap-1">
          {filterable && (
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter response…"
              aria-label="Filter response"
              className="h-7 w-44"
            />
          )}
          {filterable && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-8 px-0"
                  aria-label="Download response"
                  disabled={view.noMatch}
                  onClick={() => downloadJson(view.downloadValue, responseDownloadName(new Date()))}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Download response</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="w-8 px-0"
                aria-label="Copy response"
                disabled={view.noMatch}
                onClick={() => void navigator.clipboard.writeText(view.text)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy response</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {view.noMatch ? (
          <div className="p-3 text-sm text-muted-foreground">No matching paths.</div>
        ) : (
          <CodeMirror
            value={view.text}
            editable={false}
            extensions={EXTENSIONS}
            theme={theme === 'dark' ? 'dark' : 'light'}
            height="100%"
          />
        )}
      </div>
    </div>
  );
}
