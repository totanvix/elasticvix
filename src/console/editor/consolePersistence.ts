export const DEFAULT_TEXT = 'GET /_search\n{\n  "query": {\n    "match_all": {}\n  }\n}';

function storageKey(connectionId: string): string {
  return `elasticvix.console.${connectionId}`;
}

export function loadConsoleText(connectionId: string): string {
  try {
    const raw = localStorage.getItem(storageKey(connectionId));
    if (raw) {
      const parsed = JSON.parse(raw) as { text?: unknown };
      if (typeof parsed.text === 'string') return parsed.text;
    }
  } catch {
    /* corrupted state falls back to the default */
  }
  return DEFAULT_TEXT;
}

export function persistConsoleText(connectionId: string, text: string): void {
  localStorage.setItem(storageKey(connectionId), JSON.stringify({ text }));
}
