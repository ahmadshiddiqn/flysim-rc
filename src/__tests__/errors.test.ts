import { describe, expect, it } from 'vitest';
import { JSBSimLoadError, JSBSimPropertyError } from '../core/errors.js';

describe('JSBSim errors', () => {
  it('preserves load failure metadata', () => {
    const detail = { code: 7 };
    const error = new JSBSimLoadError('failed', { model: 'J3Cub', detail });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(JSBSimLoadError);
    expect(error.name).toBe('JSBSimLoadError');
    expect(error.model).toBe('J3Cub');
    expect(error.detail).toBe(detail);
  });

  it('formats missing property errors', () => {
    const error = new JSBSimPropertyError('simulation/missing');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(JSBSimPropertyError);
    expect(error.name).toBe('JSBSimPropertyError');
    expect(error.path).toBe('simulation/missing');
    expect(error.message).toContain('simulation/missing');
  });
});
