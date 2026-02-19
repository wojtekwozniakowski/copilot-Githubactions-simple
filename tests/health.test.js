import { describe, expect, it } from 'vitest';
import { getRuntimeHealth } from '../src/health.js';

describe('getRuntimeHealth', () => {
  it('returns object with expected shape', () => {
    const result = getRuntimeHealth();
    expect(result).toHaveProperty('ok');
    expect(result).toHaveProperty('message');
    expect(typeof result.ok).toBe('boolean');
    expect(typeof result.message).toBe('string');
  });
});
