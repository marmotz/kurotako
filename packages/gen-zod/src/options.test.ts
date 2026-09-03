import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { ZodGeneratorOptions } from './options.js';

describe('ZodGeneratorOptions', () => {
  it('defaults zodVersion to 4', () => {
    expect(v.parse(ZodGeneratorOptions, {})).toEqual({ zodVersion: 4 });
  });

  it('accepts 3', () => {
    expect(v.parse(ZodGeneratorOptions, { zodVersion: 3 })).toEqual({
      zodVersion: 3,
    });
  });

  it('rejects an unknown version', () => {
    expect(() => v.parse(ZodGeneratorOptions, { zodVersion: 5 })).toThrow();
  });
});
