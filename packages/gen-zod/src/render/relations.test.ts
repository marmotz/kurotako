import type { Relation } from '@kurotako/ir';
import { describe, expect, it, vi } from 'vitest';
import { relationExpr, relationTypeExpr } from './relations.js';

function rel(partial: Partial<Relation>): Relation {
  return {
    name: 'r',
    target: { namespace: 'blog', entity: 'Post' },
    cardinality: 'one',
    optional: false,
    owning: false,
    ...partial,
  };
}

const opts = { fromNamespace: 'blog' };

describe('relationExpr', () => {
  it('flat family -> null', () => {
    expect(relationExpr(rel({}), 'flat', 'full', opts)).toBeNull();
  });

  it('deep to-one -> z.lazy(() => <Target>DeepSchema)', () => {
    expect(relationExpr(rel({}), 'deep', 'full', opts)).toBe(
      'z.lazy(() => PostDeepSchema)',
    );
  });

  it('deep to-one optional -> .optional()', () => {
    expect(relationExpr(rel({ optional: true }), 'deep', 'full', opts)).toBe(
      'z.lazy(() => PostDeepSchema).optional()',
    );
  });

  it('deep to-many -> z.array(z.lazy(...)).optional()', () => {
    expect(
      relationExpr(rel({ cardinality: 'many' }), 'deep', 'full', opts),
    ).toBe('z.array(z.lazy(() => PostDeepSchema)).optional()');
  });

  it('deep create variant references the Create schema', () => {
    expect(relationExpr(rel({}), 'deep', 'create', opts)).toBe(
      'z.lazy(() => PostCreateDeepSchema)',
    );
  });

  it('deep select -> boolean-or-lazy union', () => {
    expect(relationExpr(rel({}), 'deep', 'select', opts)).toBe(
      'z.union([z.boolean(), z.lazy(() => PostSelectDeepSchema)]).optional()',
    );
  });

  it('cross-source relation -> null + debug log', () => {
    const debug = vi.fn();
    const out = relationExpr(
      rel({ target: { namespace: 'other', entity: 'Thing' } }),
      'deep',
      'full',
      {
        fromNamespace: 'blog',
        logger: { debug, info() {}, warn() {}, error() {} },
      },
    );
    expect(out).toBeNull();
    expect(debug).toHaveBeenCalledOnce();
  });
});

describe('relationTypeExpr', () => {
  it('flat family -> null', () => {
    expect(relationTypeExpr(rel({}), 'flat', 'full', opts)).toBeNull();
  });

  it('deep to-one required -> PostDeepDto, not optional', () => {
    expect(relationTypeExpr(rel({}), 'deep', 'full', opts)).toEqual({
      type: 'PostDeepDto',
      optional: false,
    });
  });

  it('deep to-one optional -> optional: true', () => {
    expect(
      relationTypeExpr(rel({ optional: true }), 'deep', 'full', opts),
    ).toEqual({ type: 'PostDeepDto', optional: true });
  });

  it('deep to-many -> array type, always optional', () => {
    expect(
      relationTypeExpr(rel({ cardinality: 'many' }), 'deep', 'full', opts),
    ).toEqual({ type: 'PostDeepDto[]', optional: true });
  });

  it('deep update -> optional even when the relation itself is required', () => {
    expect(relationTypeExpr(rel({}), 'deep', 'update', opts)).toEqual({
      type: 'PostUpdateDeepDto',
      optional: true,
    });
  });

  it('deep create variant references the Create Dto', () => {
    expect(relationTypeExpr(rel({}), 'deep', 'create', opts)).toEqual({
      type: 'PostCreateDeepDto',
      optional: false,
    });
  });

  it('deep select -> boolean-or-Dto union, optional', () => {
    expect(relationTypeExpr(rel({}), 'deep', 'select', opts)).toEqual({
      type: 'boolean | PostSelectDeepDto',
      optional: true,
    });
  });

  it('deep where to-one -> Dto, optional', () => {
    expect(relationTypeExpr(rel({}), 'deep', 'where', opts)).toEqual({
      type: 'PostWhereDeepDto',
      optional: true,
    });
  });

  it('deep where to-many -> some/every/none shape, optional', () => {
    expect(
      relationTypeExpr(rel({ cardinality: 'many' }), 'deep', 'where', opts),
    ).toEqual({
      type: '{ some?: PostWhereDeepDto; every?: PostWhereDeepDto; none?: PostWhereDeepDto }',
      optional: true,
    });
  });

  it('cross-source relation -> null', () => {
    expect(
      relationTypeExpr(
        rel({ target: { namespace: 'other', entity: 'Thing' } }),
        'deep',
        'full',
        opts,
      ),
    ).toBeNull();
  });
});
