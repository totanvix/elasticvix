import { describe, it, expect } from 'vitest';
import { searchDownloadName } from './downloadJson';

describe('searchDownloadName', () => {
  it('builds a filename without characters that are invalid on disk', () => {
    const name = searchDownloadName(new Date('2026-07-15T10:30:00Z'));
    expect(name).toBe('elasticvix-search-2026-07-15T10-30-00.json');
    expect(name).not.toMatch(/[:*?"<>|\\/]/);
  });
});
