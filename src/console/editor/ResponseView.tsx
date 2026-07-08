import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { EditorView } from '@codemirror/view';
import { Button } from '../ui/button';
import type { EsResult } from '../../lib/rpc/messages';
import { useTheme } from '../theme';

type Props = { response: EsResult | undefined };

function statusTone(status: number): string {
  if (status === 0) return 'bg-destructive'; // transport error
  if (status >= 200 && status < 300) return 'bg-green-500';
  return 'bg-amber-500'; // ES-level error (4xx/5xx)
}

export function ResponseView({ response }: Props) {
  const { theme } = useTheme();

  const pretty = useMemo(() => {
    if (!response) return '';
    if (response.error && response.status === 0) return `// Transport error\n${response.error}`;
    try {
      return JSON.stringify(response.body, null, 2);
    } catch {
      return String(response.body);
    }
  }, [response]);

  if (!response) {
    return <div className="p-3 text-sm text-muted-foreground">Run a request to see the response.</div>;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-2 py-1 text-sm">
        <span className={`inline-block h-2 w-2 rounded-full ${statusTone(response.status)}`} />
        <span>{response.status === 0 ? 'ERR' : response.status}</span>
        <span className="text-muted-foreground">· {response.took} ms</span>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto"
          onClick={() => void navigator.clipboard.writeText(pretty)}
        >
          Copy
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <CodeMirror
          value={pretty}
          editable={false}
          extensions={[json(), EditorView.lineWrapping]}
          theme={theme === 'dark' ? 'dark' : 'light'}
          height="100%"
        />
      </div>
    </div>
  );
}
