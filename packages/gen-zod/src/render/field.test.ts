import type { Field } from '@kurotako/ir';
import { describe, expect, it } from 'vitest';
import { dialectFor } from '../dialect.js';
import { fieldExpr } from './field.js';

const v4 = dialectFor(4);

function field(partial: Partial<Field>): Field {
  return {
    name: 'f',
    type: { kind: 'scalar', scalar: 'string' },
    list: false,
    optional: false,
    nullable: false,
    constraints: {},
    ...partial,
  };
}

describe('fieldExpr assembly', () => {
  it('nullable -> .nullable()', () => {
    expect(
      fieldExpr(
        field({ nullable: true }),
        { optional: false, variant: 'full' },
        v4,
      ),
    ).toBe('z.string().nullable()');
  });

  it('list -> z.array(...)', () => {
    expect(
      fieldExpr(
        field({ list: true }),
        { optional: false, variant: 'full' },
        v4,
      ),
    ).toBe('z.array(z.string())');
  });

  it('list + nullable + optional order', () => {
    expect(
      fieldExpr(
        field({ list: true, nullable: true }),
        { optional: true, variant: 'full' },
        v4,
      ),
    ).toBe('z.array(z.string()).nullable().optional()');
  });

  it('literal default -> .default() in create only', () => {
    const f = field({
      default: { kind: 'value', value: 7 },
      type: { kind: 'scalar', scalar: 'int' },
    });
    expect(fieldExpr(f, { optional: true, variant: 'create' }, v4)).toBe(
      'z.int().optional().default(7)',
    );
    expect(fieldExpr(f, { optional: false, variant: 'full' }, v4)).toBe(
      'z.int()',
    );
  });

  it('expr default -> never .default()', () => {
    const f = field({
      default: { kind: 'expr', expr: 'now()' },
      type: { kind: 'scalar', scalar: 'datetime' },
    });
    expect(fieldExpr(f, { optional: true, variant: 'create' }, v4)).toBe(
      'z.coerce.date().optional()',
    );
  });

  it('unknown field keeps the hint comment', () => {
    expect(
      fieldExpr(
        field({ type: { kind: 'unknown', hint: 'Point' } }),
        { optional: false, variant: 'full' },
        v4,
      ),
    ).toBe('z.unknown() // unknown: Point');
  });
});
