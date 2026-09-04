import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { NAMESPACE_RE, normalizeIssues, TakoConfigSchema } from './schema.js';

const parser = { name: 'prisma', parse: () => ({}) };
const generator = { name: 'zod', generate: () => ({}) };

function parse(input: unknown) {
  return v.safeParse(TakoConfigSchema, input);
}

describe('TakoConfigSchema', () => {
  it('accepts a minimal valid config', () => {
    const result = parse({
      sources: { pg: { use: parser } },
      generators: [{ use: generator }],
      outputs: [{}],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty sources record', () => {
    expect(parse({ sources: {}, generators: [] }).success).toBe(false);
  });

  it('rejects a bad namespace key with a located path', () => {
    for (const bad of ['1pg', 'Pg', 'pg-1']) {
      const result = parse({
        sources: { [bad]: { use: parser } },
        generators: [],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = normalizeIssues(result.issues).map((i) => i.path);
        expect(paths.some((p) => p.startsWith('sources'))).toBe(true);
      }
    }
  });

  it('rejects a driver with neither parse nor generate', () => {
    const result = parse({
      sources: { pg: { use: { name: 'x' } } },
      generators: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty outputs array', () => {
    const result = parse({
      sources: { pg: { use: parser } },
      generators: [],
      outputs: [],
    });
    expect(result.success).toBe(false);
  });

  it('accepts a minimal one-entry outputs array', () => {
    const result = parse({
      sources: { pg: { use: parser } },
      generators: [],
      outputs: [{}],
    });
    expect(result.success).toBe(true);
  });

  it("passes outputs[].mode 'package' alone (cross-field check is in load.ts)", () => {
    const result = parse({
      sources: { pg: { use: parser } },
      generators: [],
      outputs: [{ mode: 'package' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown outputs[].packageManager', () => {
    const result = parse({
      sources: { pg: { use: parser } },
      generators: [],
      outputs: [{ packageManager: 'deno' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a config with no outputs field at all', () => {
    const result = parse({
      sources: { pg: { use: parser } },
      generators: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects hooks.afterEmit that is not a function', () => {
    const result = parse({
      sources: { pg: { use: parser } },
      generators: [],
      hooks: { afterEmit: 42 },
    });
    expect(result.success).toBe(false);
  });

  it('NAMESPACE_RE matches lowerCamel identifiers only', () => {
    expect(NAMESPACE_RE.test('pg')).toBe(true);
    expect(NAMESPACE_RE.test('pgMain')).toBe(true);
    expect(NAMESPACE_RE.test('1pg')).toBe(false);
    expect(NAMESPACE_RE.test('Pg')).toBe(false);
  });
});

describe('normalizeIssues', () => {
  it('produces dotted paths', () => {
    const result = parse({
      sources: { pg: { use: parser } },
      generators: [{ use: { name: 'x' } }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = normalizeIssues(result.issues);
      expect(issues.every((i) => typeof i.path === 'string')).toBe(true);
      expect(issues.some((i) => i.path.startsWith('generators.0'))).toBe(true);
    }
  });
});
