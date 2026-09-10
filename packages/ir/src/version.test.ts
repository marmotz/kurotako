import { describe, expect, it } from 'vitest';
import { IR_VERSION, isCompatible } from './version.js';

describe('version', () => {
  it('exposes IR_VERSION as "4"', () => {
    expect(IR_VERSION).toBe('4');
  });

  it('isCompatible truth table (strict equality)', () => {
    expect(isCompatible('4')).toBe(true);
    expect(isCompatible('3')).toBe(false);
    expect(isCompatible('4.0')).toBe(false);
    expect(isCompatible('04')).toBe(false);
    expect(isCompatible('')).toBe(false);
  });
});
