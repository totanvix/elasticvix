import { describe, it, expect } from 'vitest';
import { buildAuthHeaders } from './auth';

describe('buildAuthHeaders', () => {
  it('returns no header for none', () => {
    expect(buildAuthHeaders({ type: 'none' })).toEqual({});
  });
  it('encodes basic auth as base64', () => {
    expect(buildAuthHeaders({ type: 'basic', username: 'elastic', password: 'pw' }))
      .toEqual({ Authorization: 'Basic ' + btoa('elastic:pw') });
  });
  it('formats an API key header', () => {
    expect(buildAuthHeaders({ type: 'apiKey', apiKey: 'abc123' }))
      .toEqual({ Authorization: 'ApiKey abc123' });
  });
  it('formats a bearer header', () => {
    expect(buildAuthHeaders({ type: 'bearer', token: 'tok' }))
      .toEqual({ Authorization: 'Bearer tok' });
  });
});
