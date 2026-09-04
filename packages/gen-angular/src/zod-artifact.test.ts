import { describe, expect, it } from 'vitest';
import { MissingZodNamespaceError, MissingZodSymbolError } from './errors.js';
import { fakeZodArtifact } from './testing/helpers.js';
import { blogSource, irOf } from './testing/ir.js';
import { zodEnum, zodModule, zodSymbol } from './zod-artifact.js';

describe('zod-artifact reader', () => {
  const ir = irOf(blogSource());
  const zod = fakeZodArtifact(ir);

  it('resolves a role to the Zod-emitted identifier', () => {
    expect(zodSymbol(zod, 'blog', 'User', 'createSchema')).toBe(
      'UserCreateSchema',
    );
    expect(zodSymbol(zod, 'blog', 'User', 'createType')).toBe('UserCreateDto');
  });

  it('resolves the entity module', () => {
    expect(zodModule(zod, 'blog', 'User')).toBe('blog/zod/User.schema');
  });

  it('resolves an enum ref via extra.perNamespace', () => {
    expect(zodEnum(zod, 'blog', 'Role')).toEqual({
      typeName: 'Role',
      module: 'blog/zod/enums',
    });
  });

  it('throws MissingZodSymbolError for an unknown entity', () => {
    expect(() => zodSymbol(zod, 'blog', 'Bogus', 'createSchema')).toThrow(
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
    expect(() =>
      // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed fixture
      zodSymbol(noRole as any, 'blog', 'User', 'createSchema'),
    ).toThrow(MissingZodSymbolError);
  });

  it('throws MissingZodNamespaceError for a namespace absent from extra.perNamespace', () => {
    expect(() => zodEnum(zod, 'other', 'Role')).toThrow(
      MissingZodNamespaceError,
    );
  });
});
