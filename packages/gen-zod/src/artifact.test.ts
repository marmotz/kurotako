import type { EntitySymbols } from '@kurotako/core';
import { describe, expect, it } from 'vitest';
import { buildArtifact, type ZodArtifactExtra } from './artifact.js';
import { blogSource, irOf } from './testing/ir.js';

function symbolsOf(
  artifact: ReturnType<typeof buildArtifact>,
  key: string,
): EntitySymbols {
  const e = artifact.entities[key];
  if (e === undefined) {
    throw new Error(`no artifact entity '${key}'`);
  }
  return e;
}

describe('buildArtifact', () => {
  const artifact = buildArtifact(irOf(blogSource()), { zodVersion: 4 });

  it('entities keyed by namespace.entity with the zod/ sub-tree module', () => {
    expect(Object.keys(artifact.entities).sort()).toEqual([
      'blog.Post',
      'blog.User',
    ]);
    expect(symbolsOf(artifact, 'blog.User').module).toBe(
      'blog/zod/User.schema',
    );
  });

  it('symbols carry every role', () => {
    const s = symbolsOf(artifact, 'blog.User').symbols;
    for (const role of [
      'schema',
      'type',
      'createSchema',
      'createType',
      'updateSchema',
      'updateType',
      'whereSchema',
      'whereType',
      'selectSchema',
      'selectType',
      'deepSchema',
      'deepType',
      'createDeepSchema',
      'updateDeepSchema',
      'whereDeepSchema',
      'selectDeepSchema',
    ]) {
      expect(s[role], role).toBeTruthy();
    }
    expect(s.schema).toBe('UserSchema');
    expect(s.createDeepSchema).toBe('UserCreateDeepSchema');
  });

  it('peerDependencies.zod tracks zodVersion', () => {
    expect(artifact.peerDependencies).toEqual({ zod: '^4' });
    expect(
      buildArtifact(irOf(blogSource()), { zodVersion: 3 }).peerDependencies,
    ).toEqual({ zod: '^3' });
  });

  it('extra echoes the option and lists per-namespace modules + enums', () => {
    const extra = artifact.extra as ZodArtifactExtra;
    const blog = extra.perNamespace.blog;
    if (blog === undefined) {
      throw new Error('missing blog namespace in extra');
    }
    expect(extra.zodVersion).toBe(4);
    expect(extra.families).toEqual(['flat', 'deep']);
    expect(blog.enumsModule).toBe('blog/zod/enums');
    expect(blog.filtersModule).toBe('blog/zod/filters');
    expect(blog.barrelModule).toBe('blog/zod');
    expect(blog.enums.Role).toEqual({
      constName: 'Role',
      schemaName: 'RoleSchema',
      typeName: 'Role',
      module: 'blog/zod/enums',
    });
  });
});
