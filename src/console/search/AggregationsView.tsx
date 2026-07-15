import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { EditorView } from '@codemirror/view';
import { useTheme } from '../theme';

type Props = {
  responseBody: unknown;
};

export function AggregationsView({ responseBody }: Props) {
  const { theme } = useTheme();
  const aggs = (responseBody as { aggregations?: unknown } | null | undefined)?.aggregations;
  const pretty = useMemo(() => (aggs === undefined ? '' : JSON.stringify(aggs, null, 2)), [aggs]);

  if (aggs === undefined) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        The query has no aggregations. Add an &quot;aggs&quot; block and search again.
      </div>
    );
  }

  return (
    <CodeMirror
      value={pretty}
      editable={false}
      extensions={[json(), EditorView.lineWrapping]}
      theme={theme === 'dark' ? 'dark' : 'light'}
      height="100%"
    />
  );
}
