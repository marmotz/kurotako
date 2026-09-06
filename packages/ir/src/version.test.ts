import { describe, expect, it } from 'vitest';
import { IR_VERSION, isCompatible } from './version.js';

describe('version', () => {
  it('exposes IR_VERSION as "2"', () => {
    expect(IR_VERSION).toBe('2');
  });

  it('isCompatible truth table (strict equality)', () => {
    expect(isCompatible('2')).toBe(true);
    expect(isCompatible('1')).toBe(false);
    expect(isCompatible('2.0')).toBe(false);
    expect(isCompatible('02')).toBe(false);
    expect(isCompatible('')).toBe(false);
  });
});
