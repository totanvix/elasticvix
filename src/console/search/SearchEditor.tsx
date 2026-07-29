import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { autocompletion } from '@codemirror/autocomplete';
import { Prec } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import type { FlatField } from '../../lib/types';
import { bodyCompletionSource } from '../../lib/autocomplete/engine';
import { searchFieldLinter } from '../editor/editorExtensions';
import { useTheme } from '../theme';

type Props = {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  getFields: () => Promise<FlatField[]>;
  getFieldValues: (field: string) => Promise<string[]>;
  lintEnabled: boolean;
};

export function SearchEditor({ value, onChange, onRun, getFields, getFieldValues, lintEnabled }: Props) {
  const { theme } = useTheme();

  const extensions = useMemo(
    () => [
      json(),
      autocompletion({ override: [bodyCompletionSource(getFields, getFieldValues)] }),
      ...(lintEnabled ? [searchFieldLinter(getFields)] : []),
      // Highest precedence so basicSetup's default Mod-Enter (insertBlankLine) doesn't win.
      Prec.highest(
        keymap.of([
          {
            key: 'Mod-Enter',
            run: () => {
              onRun();
              return true;
            },
          },
        ]),
      ),
    ],
    [getFields, getFieldValues, onRun, lintEnabled],
  );

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      theme={theme === 'dark' ? 'dark' : 'light'}
      height="100%"
      className="h-full"
    />
  );
}
