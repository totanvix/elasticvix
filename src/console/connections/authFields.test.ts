import { describe, it, expect } from 'vitest';
import { initialAuthFields } from './authFields';

describe('initialAuthFields', () => {
  it('prefills basic auth credentials', () => {
    expect(initialAuthFields({ type: 'basic', username: 'elastic', password: 's3cret' })).toEqual({
      username: 'elastic',
      password: 's3cret',
      secret: '',
    });
  });

  it('prefills the shared secret field for apiKey and bearer', () => {
    expect(initialAuthFields({ type: 'apiKey', apiKey: 'abc' })).toEqual({ username: '', password: '', secret: 'abc' });
    expect(initialAuthFields({ type: 'bearer', token: 'tok' })).toEqual({ username: '', password: '', secret: 'tok' });
  });

  it('returns empty fields for none or missing auth', () => {
    expect(initialAuthFields({ type: 'none' })).toEqual({ username: '', password: '', secret: '' });
    expect(initialAuthFields(undefined)).toEqual({ username: '', password: '', secret: '' });
  });
});
