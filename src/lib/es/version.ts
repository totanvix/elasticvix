import type { EsMajor } from '../types';

export function parseMajor(version: string): EsMajor | undefined {
  const m = /^(\d+)\./.exec(version.trim());
  if (!m) return undefined;
  const major = Number(m[1]);
  return major === 6 || major === 7 || major === 8 || major === 9 ? major : undefined;
}
