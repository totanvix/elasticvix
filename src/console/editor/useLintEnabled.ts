import { useCallback, useState } from 'react';

export const LINT_ENABLED_KEY = 'elasticvix.lint.fields';

// Default ON: only an explicit 'false' disables it.
export function loadLintEnabled(): boolean {
  return localStorage.getItem(LINT_ENABLED_KEY) !== 'false';
}

export function saveLintEnabled(enabled: boolean): void {
  localStorage.setItem(LINT_ENABLED_KEY, enabled ? 'true' : 'false');
}

export function useLintEnabled(): { enabled: boolean; toggle: () => void } {
  const [enabled, setEnabled] = useState<boolean>(() => loadLintEnabled());
  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      saveLintEnabled(next);
      return next;
    });
  }, []);
  return { enabled, toggle };
}
