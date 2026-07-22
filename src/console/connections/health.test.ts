import { describe, it, expect } from 'vitest';
import { connectionTitle, healthOutcome, nextRetryDelay, statusDotClass, toClusterStatus } from './health';

describe('toClusterStatus', () => {
  it('accepts the three ES statuses', () => {
    expect(toClusterStatus({ status: 'green' })).toBe('green');
    expect(toClusterStatus({ status: 'yellow' })).toBe('yellow');
    expect(toClusterStatus({ status: 'red' })).toBe('red');
  });

  it('maps anything else to unknown', () => {
    expect(toClusterStatus({ status: 'purple' })).toBe('unknown');
    expect(toClusterStatus({})).toBe('unknown');
    expect(toClusterStatus(undefined)).toBe('unknown');
  });
});

describe('healthOutcome', () => {
  it('is connected on a 2xx health response', () => {
    expect(healthOutcome({ status: 200, took: 3, body: { status: 'green' } })).toEqual({ isOk: true });
  });

  it('is disconnected with the transport error message', () => {
    expect(healthOutcome({ status: 0, took: 3, body: null, error: 'Failed to fetch' })).toEqual({
      isOk: false,
      reason: 'Failed to fetch',
    });
  });

  it('is disconnected on an HTTP error status', () => {
    expect(healthOutcome({ status: 401, took: 3, body: {} })).toEqual({ isOk: false, reason: 'HTTP 401' });
  });
});

describe('nextRetryDelay', () => {
  it('doubles from 2s per consecutive failure', () => {
    expect(nextRetryDelay(1)).toBe(2_000);
    expect(nextRetryDelay(2)).toBe(4_000);
    expect(nextRetryDelay(3)).toBe(8_000);
    expect(nextRetryDelay(4)).toBe(16_000);
  });

  it('caps at 30s', () => {
    expect(nextRetryDelay(5)).toBe(30_000);
    expect(nextRetryDelay(50)).toBe(30_000);
  });
});

describe('statusDotClass', () => {
  it('is gray while checking, regardless of cluster status', () => {
    expect(statusDotClass('checking', 'green')).toBe('bg-gray-400');
  });

  it('is red when disconnected, regardless of cluster status', () => {
    expect(statusDotClass('disconnected', 'green')).toBe('bg-red-500');
    expect(statusDotClass('disconnected', 'unknown')).toBe('bg-red-500');
  });

  it('shows cluster health color when connected', () => {
    expect(statusDotClass('connected', 'green')).toBe('bg-green-500');
    expect(statusDotClass('connected', 'yellow')).toBe('bg-amber-500');
    expect(statusDotClass('connected', 'red')).toBe('bg-red-500');
    expect(statusDotClass('connected', 'unknown')).toBe('bg-gray-400');
  });
});

describe('connectionTitle', () => {
  it('describes each phase, with the failure reason when disconnected', () => {
    expect(connectionTitle('checking', 'unknown')).toBe('Checking connection…');
    expect(connectionTitle('connected', 'yellow')).toBe('Connected — cluster health: yellow');
    expect(connectionTitle('disconnected', 'unknown', 'Failed to fetch')).toBe('Disconnected — Failed to fetch');
    expect(connectionTitle('disconnected', 'unknown')).toBe('Disconnected — unreachable');
  });
});
