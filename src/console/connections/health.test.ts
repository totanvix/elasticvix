import { describe, it, expect } from 'vitest';
import { healthDotClass, toClusterStatus } from './health';

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

describe('healthDotClass', () => {
  it('maps each status to a tailwind dot class', () => {
    expect(healthDotClass('green')).toBe('bg-green-500');
    expect(healthDotClass('yellow')).toBe('bg-amber-500');
    expect(healthDotClass('red')).toBe('bg-red-500');
    expect(healthDotClass('unknown')).toBe('bg-gray-400');
  });
});
