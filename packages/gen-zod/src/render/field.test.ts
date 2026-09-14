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
    ).toEqual({ expr: 'z.string().nullable()', comment: null });
  });

  it('list -> z.array(...)', () => {
    expect(
      fieldExpr(
        field({ list: true }),
        { optional: false, variant: 'full' },
        v4,
      ),
    ).toEqual({ expr: 'z.array(z.string())', comment: null });
  });

  it('list + array field type -> z.array(z.array(...)) (nested-array property)', () => {
    expect(
      fieldExpr(
        field({
          list: true,
          type: { kind: 'array', element: { kind: 'scalar', scalar: 'int' } },
        }),
        { optional: false, variant: 'full' },
        v4,
      ),
    ).toEqual({ expr: 'z.array(z.array(z.int()))', comment: null });
  });

  it('list + nullable + optional order', () => {
    expect(
      fieldExpr(
        field({ list: true, nullable: true }),
        { optional: true, variant: 'full' },
        v4,
      ),
    ).toEqual({
      expr: 'z.array(z.string()).nullable().optional()',
      comment: null,
    });
  });

  it('literal default -> .default() in create only', () => {
    const f = field({
      default: { kind: 'value', value: 7 },
      type: { kind: 'scalar', scalar: 'int' },
    });
    expect(fieldExpr(f, { optional: true, variant: 'create' }, v4)).toEqual({
      expr: 'z.int().optional().default(7)',
      comment: null,
    });
    expect(fieldExpr(f, { optional: false, variant: 'full' }, v4)).toEqual({
      expr: 'z.int()',
      comment: null,
    });
  });

  it('expr default -> never .default()', () => {
    const f = field({
      default: { kind: 'expr', expr: 'now()' },
      type: { kind: 'scalar', scalar: 'datetime' },
    });
    expect(fieldExpr(f, { optional: true, variant: 'create' }, v4)).toEqual({
      expr: 'z.coerce.date().optional()',
      comment: null,
    });
  });

  it('unknown field keeps the hint comment', () => {
    expect(
      fieldExpr(
        field({ type: { kind: 'unknown', hint: 'Point' } }),
        { optional: false, variant: 'full' },
        v4,
      ),
    ).toEqual({ expr: 'z.unknown()', comment: '// unknown: Point' });
  });
});
