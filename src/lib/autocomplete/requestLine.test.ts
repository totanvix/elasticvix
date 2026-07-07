import { describe, it, expect } from 'vitest';
import { parseRequestLine } from './requestLine';

describe('parseRequestLine', () => {
  it('parses method, index and endpoint', () => {
    expect(parseRequestLine('GET /logs-*/_search')).toEqual({
      method: 'GET', path: '/logs-*/_search', index: 'logs-*', endpoint: '_search',
    });
  });
  it('handles a pure endpoint with no index', () => {
    expect(parseRequestLine('GET /_cat/indices')).toEqual({
      method: 'GET', path: '/_cat/indices', index: undefined, endpoint: '_cat/indices',
    });
  });
  it('defaults the method to GET when omitted', () => {
    expect(parseRequestLine('/my-index/_doc/1').method).toBe('GET');
  });
  it('lowercases nothing but uppercases the method', () => {
    expect(parseRequestLine('post /x/_search').method).toBe('POST');
  });
});
