import { describe, expect, it } from 'vitest';
import { PrismaHiddenFieldError } from '../errors.js';
import { assertHiddenOptionResolves, extractHidden } from './hidden.js';

describe('extractHidden', () => {
  it('leaves an untagged doc alone', () => {
    expect(extractHidden(undefined)).toEqual({ hidden: false, doc: undefined });
    expect(extractHidden('the email')).toEqual({
      hidden: false,
      doc: 'the email',
    });
  });

  it('flags the tag and removes its line, keeping the prose', () => {
    expect(extractHidden('@kurotako.hidden')).toEqual({
      hidden: true,
      doc: undefined,
    });
    expect(
      extractHidden('bcrypt hash\n@kurotako.hidden\nnever expose'),
    ).toEqual({
      hidden: true,
      doc: 'bcrypt hash\nnever expose',
    });
    expect(extractHidden('  @kurotako.hidden  ')).toMatchObject({
      hidden: true,
    });
  });

  it('does not treat the tag inside a sentence as the annotation', () => {
    expect(extractHidden('see @kurotako.hidden for details')).toEqual({
      hidden: false,
      doc: 'see @kurotako.hidden for details',
    });
  });
});

describe('assertHiddenOptionResolves', () => {
  const entities = [
    { name: 'User', fields: [{ name: 'id' }, { name: 'passwordHash' }] },
  ];

  it('accepts an absent option and known names', () => {
    expect(() => assertHiddenOptionResolves(undefined, entities)).not.toThrow();
    expect(() =>
      assertHiddenOptionResolves({ User: ['passwordHash'] }, entities),
    ).not.toThrow();
  });

  it('names every unknown entity or field', () => {
    try {
      assertHiddenOptionResolves(
        { User: ['passwordHsh'], Ghost: ['x'] },
        entities,
      );
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(PrismaHiddenFieldError);
      expect((error as PrismaHiddenFieldError).unknown).toEqual([
        'User.passwordHsh',
        'Ghost.x',
      ]);
      expect((error as Error).message).toContain('User.passwordHsh, Ghost.x');
    }
  });
});
