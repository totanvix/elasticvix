import { describe, it, expect } from 'vitest';
import { lintTargets } from './lintTargets';

describe('lintTargets', () => {
  it('maps lintable blocks and skips no-bodyRef and wildcard blocks', () => {
    const doc = [
      'GET /logs/_search',
      '{ "query": {} }',
      '',
      'GET /_cat/indices',
      '',
      'GET /logs-*/_search',
      '{ "query": {} }',
      '',
      'POST /users/_count',
      '{ "query": {} }',
    ].join('\n');
    expect(lintTargets(doc)).toEqual([
      { bodyText: '{ "query": {} }', bodyFrom: doc.indexOf('{ "query"'), index: 'logs', bodyRef: 'queryBody' },
      { bodyText: '{ "query": {} }', bodyFrom: doc.lastIndexOf('{ "query"'), index: 'users', bodyRef: 'queryBody' },
    ]);
  });
  it('skips a block with an empty body', () => {
    expect(lintTargets('GET /logs/_search')).toEqual([]);
  });
  it('skips comma multi-index targets', () => {
    expect(lintTargets('GET /a,b/_search\n{}')).toEqual([]);
  });
});
