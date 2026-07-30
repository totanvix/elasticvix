import { describe, it, expect } from 'vitest';
import { searchDownloadName, responseDownloadName } from './downloadJson';

describe('searchDownloadName', () => {
  it('builds a filename without characters that are invalid on disk', () => {
    const name = searchDownloadName(new Date('2026-07-15T10:30:00Z'));
    expect(name).toBe('elasticvix-search-2026-07-15T10-30-00.json');
    expect(name).not.toMatch(/[:*?"<>|\\/]/);
  });
});

describe('responseDownloadName', () => {
  it('builds a timestamped response filename', () => {
    expect(responseDownloadName(new Date('2026-07-30T12:34:56.000Z'))).toBe(
      'elasticvix-response-2026-07-30T12-34-56.json',
    );
  });
});
