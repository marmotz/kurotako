import type { Relation } from '@kurotako/ir';
import { describe, expect, it, vi } from 'vitest';
import { relationExpr } from './relations.js';

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
