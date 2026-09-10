import { describe, expect, it } from 'vitest';
import { IR_VERSION, isCompatible } from './version.js';

describe('version', () => {
  it('exposes IR_VERSION as "3"', () => {
    expect(IR_VERSION).toBe('3');
  });

  it('isCompatible truth table (strict equality)', () => {
    expect(isCompatible('3')).toBe(true);
    expect(isCompatible('2')).toBe(false);
    expect(isCompatible('3.0')).toBe(false);
    expect(isCompatible('03')).toBe(false);
    expect(isCompatible('')).toBe(false);
  });
});
