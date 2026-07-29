import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { keymap } from '@codemirror/view';
import { SpellCheck } from 'lucide-react';
import { Button } from '../ui/button';
import type { Connection } from '../../lib/types';
import { useTheme } from '../theme';
import { makeGetFields } from './getFields';
import { makeGetFieldValues } from './getFieldValues';
import { buildEditorExtensions } from './editorExtensions';
import { useLintEnabled } from './useLintEnabled';

type Props = {
  active: Connection | undefined;
  text: string;
  onChange: (value: string) => void;
  onRun: () => void;
  isRunning: boolean;
  onFormat: () => void;
  onSave: () => void;
};

export function QueryEditor({ active, text, onChange, onRun, isRunning, onFormat, onSave }: Props) {
  const { theme } = useTheme();
  const { enabled: lintEnabled, toggle: toggleLint } = useLintEnabled();

  const extensions = useMemo(() => {
    const getFields = makeGetFields(active);
    const getFieldValues = makeGetFieldValues(active);
    return [
      ...buildEditorExtensions(getFields, getFieldValues, lintEnabled),
      keymap.of([
        {
          key: 'Mod-Enter',
          run: () => {
            onRun();
            return true;
          },
        },
      ]),
    ];
  }, [active, onRun, lintEnabled]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-2 py-1">
        <Button size="sm" onClick={onRun} disabled={isRunning}>
          {isRunning ? 'Running…' : 'Run ⌘↵'}
        </Button>
        <Button size="sm" variant="outline" onClick={onSave}>
          Save
        </Button>
        <Button size="sm" variant="outline" onClick={onFormat}>
          Format
        </Button>
        <Button
          size="sm"
          variant={lintEnabled ? 'secondary' : 'ghost'}
          onClick={toggleLint}
          aria-label="Toggle field linting"
          title={lintEnabled ? 'Field linting on' : 'Field linting off'}
        >
          <SpellCheck className="h-4 w-4" /> Lint
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <CodeMirror
          value={text}
          onChange={onChange}
          extensions={extensions}
          theme={theme === 'dark' ? 'dark' : 'light'}
          height="100%"
        />
      </div>
    </div>
  );
}
