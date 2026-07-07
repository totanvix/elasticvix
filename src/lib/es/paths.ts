import type { EsMajor } from '../types';

export function docPath(opts: { index: string; id?: string; type?: string; major?: EsMajor }): string {
  const segment = opts.major === 6 && opts.type ? opts.type : '_doc';
  const base = `/${opts.index}/${segment}`;
  return opts.id ? `${base}/${opts.id}` : base;
}
