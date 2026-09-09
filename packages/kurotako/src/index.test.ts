import { describe, expect, it } from 'vitest';
import * as kurotako from './index.js';

describe('kurotako barrel', () => {
  it('re-exports defineConfig as runtime identity', () => {
    const config = { sources: {}, generators: [], outputs: [] } as const;
    expect(kurotako.defineConfig(config)).toBe(config);
  });

  it('re-exports defineParser, defineGenerator and typescriptGenerator', () => {
    expect(typeof kurotako.defineParser).toBe('function');
    expect(typeof kurotako.defineGenerator).toBe('function');
    expect(kurotako.typescriptGenerator.name).toBe('typescript');
  });

  it('does not re-export loader internals', () => {
    expect('loadConfig' in kurotako).toBe(false);
    expect('TakoConfigSchema' in kurotako).toBe(false);
    expect('CONFIG_TEMPLATE' in kurotako).toBe(false);
    expect('ConfigNotFoundError' in kurotako).toBe(false);
  });
});
