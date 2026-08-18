import { useMemo, useRef } from 'react';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { Prec } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { Wand2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import type { Connection } from '../../lib/types';
import { useTheme } from '../theme';
import { makeGetFields } from './getFields';
import { makeGetFieldValues } from './getFieldValues';
import { buildEditorExtensions } from './editorExtensions';
import { useLintEnabled } from './useLintEnabled';
import { LintToggle } from './LintToggle';

type Props = {
  active: Connection | undefined;
  text: string;
  onChange: (value: string) => void;
  onRun: (pos: number) => void;
  isRunning: boolean;
  onFormat: () => void;
  onSave: () => void;
};

export function QueryEditor({ active, text, onChange, onRun, isRunning, onFormat, onSave }: Props) {
  const { theme } = useTheme();
  const { enabled: lintEnabled, toggle: toggleLint } = useLintEnabled();

  // Ref-backed so the extensions array doesn't rebuild (and reconfigure the
  // editor) every time `onRun` changes identity with the editor text.
  const onRunRef = useRef(onRun);
  onRunRef.current = onRun;

  const cmRef = useRef<ReactCodeMirrorRef>(null);
  const cursorPos = () => cmRef.current?.view?.state.selection.main.head ?? 0;

  const extensions = useMemo(() => {
    const getFields = makeGetFields(active);
    const getFieldValues = makeGetFieldValues(active);
    return [
      ...buildEditorExtensions(getFields, getFieldValues, lintEnabled),
      // Highest precedence so basicSetup's default Mod-Enter (insertBlankLine) doesn't win.
      Prec.highest(
        keymap.of([
          {
            key: 'Mod-Enter',
            run: (view) => {
              onRunRef.current(view.state.selection.main.head);
              return true;
            },
          },
        ]),
      ),
    ];
  }, [active, lintEnabled]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-2 py-1">
        <Button size="sm" onClick={() => onRun(cursorPos())} disabled={isRunning}>
          {isRunning ? 'Running…' : 'Run ⌘↵'}
        </Button>
        <Button size="sm" variant="outline" onClick={onSave}>
          Save
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="outline" className="w-8 px-0" onClick={onFormat} aria-label="Format">
              <Wand2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Format</TooltipContent>
        </Tooltip>
        <LintToggle enabled={lintEnabled} onToggle={toggleLint} />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <CodeMirror
          ref={cmRef}
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
