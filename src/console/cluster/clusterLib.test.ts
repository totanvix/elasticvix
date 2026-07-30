import { describe, it, expect } from 'vitest';
import {
  parseClusterHealth, parseClusterInfo, parseClusterStats, parseNodes, formatBytes, formatInt,
} from './clusterLib';

describe('parseClusterHealth', () => {
  const body = {
    cluster_name: 'c', status: 'yellow', number_of_nodes: 1, number_of_data_nodes: 1,
    active_primary_shards: 2, active_shards: 2, relocating_shards: 0, initializing_shards: 0,
    unassigned_shards: 2, delayed_unassigned_shards: 0, number_of_pending_tasks: 0,
    active_shards_percent_as_number: 50.0,
  };
  it('maps fields and rounds percent', () => {
    const h = parseClusterHealth(body)!;
    expect(h.status).toBe('yellow');
    expect(h.clusterName).toBe('c');
    expect(h.nodes).toBe(1);
    expect(h.unassigned).toBe(2);
    expect(h.activePercent).toBe(50);
  });
  it('keeps a genuine zero (not undefined)', () => {
    expect(parseClusterHealth({ ...body, unassigned_shards: 0 })!.unassigned).toBe(0);
  });
  it('rounds a fractional percent', () => {
    expect(parseClusterHealth({ ...body, active_shards_percent_as_number: 66.6667 })!.activePercent).toBe(67);
  });
  it('leaves missing fields undefined but still returns status unknown', () => {
    const h = parseClusterHealth({})!;
    expect(h.status).toBe('unknown');
    expect(h.nodes).toBeUndefined();
  });
  it('returns undefined for a non-object body', () => {
    expect(parseClusterHealth(null)).toBeUndefined();
    expect(parseClusterHealth('x')).toBeUndefined();
  });
});

describe('parseClusterInfo', () => {
  it('reads version fields from GET /', () => {
    const i = parseClusterInfo({ cluster_name: 'c', version: { number: '8.14.0', build_flavor: 'default', lucene_version: '9.10.0' } })!;
    expect(i.versionNumber).toBe('8.14.0');
    expect(i.buildFlavor).toBe('default');
    expect(i.luceneVersion).toBe('9.10.0');
  });
  it('exposes an OpenSearch distribution', () => {
    expect(parseClusterInfo({ version: { number: '2.11.0', distribution: 'opensearch' } })!.distribution).toBe('opensearch');
  });
  it('returns undefined for a non-object body', () => {
    expect(parseClusterInfo(42)).toBeUndefined();
  });
});

describe('parseClusterStats', () => {
  it('reads indices counts and store size', () => {
    const s = parseClusterStats({ indices: { count: 2, docs: { count: 700 }, store: { size_in_bytes: 81128 } } })!;
    expect(s).toEqual({ indices: 2, docs: 700, storeBytes: 81128 });
  });
  it('tolerates missing subtrees', () => {
    expect(parseClusterStats({})).toEqual({ indices: undefined, docs: undefined, storeBytes: undefined });
  });
  it('returns undefined for a non-object body', () => {
    expect(parseClusterStats(null)).toBeUndefined();
  });
});

describe('parseNodes', () => {
  const row = {
    name: 'n1', version: '8.14.0', master: '*', cpu: '0',
    'ram.current': '1.5gb', 'ram.max': '7.8gb', 'ram.percent': '20',
    'heap.current': '290.5mb', 'heap.max': '512mb', 'heap.percent': '56',
    'disk.used': '15.8gb', 'disk.total': '99.3gb', 'disk.used_percent': '15.93',
  };
  it('maps a node row and rounds percents', () => {
    const [n] = parseNodes([row])!;
    expect(n.name).toBe('n1');
    expect(n.isMaster).toBe(true);
    expect(n.ramPercent).toBe(20);
    expect(n.diskPercent).toBe(16); // 15.93 -> 16
    expect(n.ramCurrent).toBe('1.5gb');
  });
  it('flags a non-master node', () => {
    expect(parseNodes([{ ...row, master: '-' }])![0].isMaster).toBe(false);
  });
  it('leaves missing metrics undefined', () => {
    const [n] = parseNodes([{ name: 'n2' }])!;
    expect(n.ramPercent).toBeUndefined();
    expect(n.ramCurrent).toBeUndefined();
  });
  it('returns [] for an empty array and undefined for a non-array', () => {
    expect(parseNodes([])).toEqual([]);
    expect(parseNodes({})).toBeUndefined();
  });
});

describe('formatBytes', () => {
  it('formats across units with a 0 B floor', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(81128)).toBe('79.2 KB');
    expect(formatBytes(8394457088)).toBe('7.8 GB');
  });
});

describe('formatInt', () => {
  it('adds thousands separators', () => {
    expect(formatInt(700)).toBe('700');
    expect(formatInt(1234567)).toBe('1,234,567');
  });
});
