import { describe, expect, it } from 'vitest';
import { MissingZodDependencyError, MissingZodSymbolError } from './errors.js';
import { fakeZodArtifact } from './testing/helpers.js';
import { blogSource, irOf } from './testing/ir.js';
import {
  readZodDependency,
  zodExtra,
  zodModule,
  zodRoles,
  zodSymbol,
} from './zod-artifact.js';

describe('zod-artifact reader', () => {
  const ir = irOf(blogSource());
  const zod = fakeZodArtifact(ir);

  it('resolves a role to the Zod-emitted identifier', () => {
    expect(zodSymbol(zod, 'blog', 'User', 'schema')).toBe('UserSchema');
    expect(zodSymbol(zod, 'blog', 'User', 'createType')).toBe('UserCreateDto');
    expect(zodSymbol(zod, 'blog', 'User', 'updateDeepSchema')).toBe(
      'UserUpdateDeepSchema',
    );
  });

  it('resolves the entity module', () => {
    expect(zodModule(zod, 'blog', 'User')).toBe(
      'blog/react-tanstack/zod/User.schema',
    );
  });

  it('exposes the artifact extra', () => {
    expect(zodExtra(zod).zodVersion).toBe(4);
  });

  it('throws MissingZodSymbolError for an unknown entity', () => {
    expect(() => zodSymbol(zod, 'blog', 'Bogus', 'schema')).toThrow(
      MissingZodSymbolError,
    );
    expect(() => zodModule(zod, 'blog', 'Bogus')).toThrow(
      MissingZodSymbolError,
    );
  });

  it('throws MissingZodSymbolError for an unknown role', () => {
    const noRole = {
      entities: {
        'blog.User': { module: 'blog/zod/User.schema', symbols: {} },
      },
      extra: zod.extra,
    };
    expect(() => zodSymbol(noRole, 'blog', 'User', 'schema')).toThrow(
      MissingZodSymbolError,
    );
  });

  it('readZodDependency returns ctx.dependencies.zod or throws', () => {
    expect(readZodDependency({ zod })).toBe(zod);
    expect(() => readZodDependency({})).toThrow(MissingZodDependencyError);
  });

  it('zodRoles maps (variant, family) to the role pair', () => {
    expect(zodRoles('full', false)).toEqual({ schema: 'schema', type: 'type' });
    expect(zodRoles('create', false)).toEqual({
      schema: 'createSchema',
      type: 'createType',
    });
    expect(zodRoles('update', false)).toEqual({
      schema: 'updateSchema',
      type: 'updateType',
    });
    expect(zodRoles('full', true)).toEqual({
      schema: 'deepSchema',
      type: 'deepType',
    });
    expect(zodRoles('create', true)).toEqual({
      schema: 'createDeepSchema',
      type: 'createDeepType',
    });
    expect(zodRoles('update', true)).toEqual({
      schema: 'updateDeepSchema',
      type: 'updateDeepType',
    });
  });
});
