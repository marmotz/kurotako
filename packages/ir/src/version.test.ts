import { describe, expect, it } from 'vitest';
import { IR_VERSION, isCompatible } from './version.js';

describe('version', () => {
  it('exposes IR_VERSION as "1"', () => {
    expect(IR_VERSION).toBe('1');
  });

  it('isCompatible truth table (v1: strict equality)', () => {
    expect(isCompatible('1')).toBe(true);
    expect(isCompatible('2')).toBe(false);
    expect(isCompatible('1.0')).toBe(false);
    expect(isCompatible('01')).toBe(false);
    expect(isCompatible('')).toBe(false);
  });
});
