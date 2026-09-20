import { describe, expect, it } from 'vitest';
import { defineConfig } from './define.js';
import { defineGenerator } from './define-driver.js';

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

describe('defineGenerator', () => {
  const out = () => ({ files: [], artifact: { entities: {} } });

  it('returns its input unchanged (identity), static dependsOn included', () => {
    const zod = defineGenerator({ name: 'zod', generate: out });
    const input = {
      name: 'angular',
      dependsOn: [{ use: zod }],
      generate: out,
    };
    expect(defineGenerator(input)).toBe(input);
  });

  it('keeps the function form of dependsOn callable with the dependent options', () => {
    const zod = defineGenerator({ name: 'zod', generate: out });
    const angular = defineGenerator({
      name: 'angular',
      dependsOn: () => [{ use: zod }],
      generate: out,
    });
    expect(typeof angular.dependsOn).toBe('function');
  });
});
