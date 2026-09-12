import type { GenerateContext, GenOutput } from '@kurotako/core';
import type { IR } from '@kurotako/ir';
import { describe, expect, it } from 'vitest';
import { openapiGenerator } from './generator.js';
import { blogSource, geoSource, irOf } from './testing/ir.js';

const noopLogger = { debug() {}, info() {}, warn() {}, error() {} };

function run(
  ir: IR,
  options: Parameters<typeof openapiGenerator.generate>[1],
): GenOutput {
  const ctx: GenerateContext = {
    ir,
    dependencies: {},
    cycles: new Set(),
    logger: noopLogger,
  };
  const out = openapiGenerator.generate(ctx, options);
  if (out instanceof Promise) {
    throw new Error('openapiGenerator.generate must be synchronous');
  }
  return out;
}

const jsonOptions = {
  openapiVersion: '3.1' as const,
  format: 'json' as const,
  version: '0.0.0',
};

describe('openapiGenerator.generate', () => {
  it('emits one openapi.json file per namespace', () => {
    const out = run(irOf(blogSource(), geoSource()), jsonOptions);
    expect(out.files.map((f) => f.path)).toEqual([
      'blog/openapi/openapi.json',
      'geo/openapi/openapi.json',
    ]);
  });

  it('emits openapi.yaml when format is yaml', () => {
    const out = run(irOf(blogSource()), {
      ...jsonOptions,
      format: 'yaml',
    });
    expect(out.files.map((f) => f.path)).toEqual(['blog/openapi/openapi.yaml']);
    expect(out.files[0]?.content).toContain('openapi: 3.1.0');
  });

  it('emits a parseable JSON document with entities as components/schemas', () => {
    const out = run(irOf(blogSource()), jsonOptions);
    const content = out.files[0]?.content ?? '';
    const doc = JSON.parse(content);
    expect(Object.keys(doc.components.schemas)).toEqual([
      'Post',
      'Role',
      'User',
    ]);
  });

  it('builds the artifact with one EntitySymbols per entity', () => {
    const out = run(irOf(blogSource()), jsonOptions);
    expect(out.artifact.entities).toEqual({
      'blog.User': {
        module: 'blog/openapi/openapi.json',
        symbols: { schema: '#/components/schemas/User' },
      },
      'blog.Post': {
        module: 'blog/openapi/openapi.json',
        symbols: { schema: '#/components/schemas/Post' },
      },
    });
    expect(out.artifact.peerDependencies).toBeUndefined();
    expect(out.artifact.extra).toBeUndefined();
  });

  it('the artifact module points at .yaml when format is yaml', () => {
    const out = run(irOf(blogSource()), { ...jsonOptions, format: 'yaml' });
    expect(out.artifact.entities['blog.User']?.module).toBe(
      'blog/openapi/openapi.yaml',
    );
  });

  it('is deterministic: same IR + options -> deep-equal GenOutput', () => {
    const a = run(irOf(blogSource()), jsonOptions);
    const b = run(irOf(blogSource()), jsonOptions);
    expect(a).toEqual(b);
  });
});
