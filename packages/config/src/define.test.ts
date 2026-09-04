import { describe, expect, it } from 'vitest';
import { defineConfig } from './define.js';

describe('defineConfig', () => {
  it('returns its input unchanged (identity)', () => {
    const input = {
      sources: {},
      generators: [],
      outputs: [{ dir: './out' }],
    };
    expect(defineConfig(input)).toBe(input);
  });
});
