import type { SourceIR } from '@kurotako/ir';
import { createSourceIR } from '@kurotako/ir';
import { describe, expect, it } from 'vitest';
import { IrValidationError, NamespaceMismatchError } from './errors.js';
import { mergeSources } from './merge.js';

function makeSource(namespace: string): SourceIR {
  return createSourceIR({ namespace, parser: 'prisma' })
    .addEntity('User', (e) => {
      e.field('id', (f) => f.scalar('uuid').primary());
    })
    .build();
}

describe('mergeSources', () => {
  it('merges two sources into { irVersion, sources } in input order', () => {
    const ir = mergeSources([
      { namespace: 'b', sourceIR: makeSource('b') },
      { namespace: 'a', sourceIR: makeSource('a') },
    ]);
    expect(ir.irVersion).toBe('2');
    expect(Object.keys(ir.sources)).toEqual(['b', 'a']);
  });

  it('rejects a namespace mismatch', () => {
    expect(() =>
      mergeSources([{ namespace: 'a', sourceIR: makeSource('b') }]),
    ).toThrow(NamespaceMismatchError);
  });

  it('surfaces a per-source validation failure tagged with its namespace', () => {
    const broken = makeSource('a');
    // Duplicate the `id` field: schema-valid shape, but checkSource (run by
    // validateSourceIR) flags `duplicate_field`.
    const first = broken.entities.User?.fields[0];
    if (first) {
      broken.entities.User?.fields.push({ ...first });
    }
    try {
      mergeSources([{ namespace: 'a', sourceIR: broken }]);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(IrValidationError);
      expect((error as IrValidationError).namespace).toBe('a');
    }
  });

  it('surfaces a post-merge cross-source relation failure as IrValidationError', () => {
    // Per-source, `a` builds fine: the relation targets `b`, absent from the
    // single-source view, so it is treated as informational. After merge, `b`
    // is present and has no relation named `author` -> unresolved_back_relation.
    const a = createSourceIR({ namespace: 'a', parser: 'prisma' })
      .addEntity('User', (e) => {
        e.field('id', (f) => f.scalar('uuid').primary());
        e.relation('posts', (r) =>
          r.to('b', 'Post').many().backRelation('author'),
        );
      })
      .build();
    const b = createSourceIR({ namespace: 'b', parser: 'prisma' })
      .addEntity('Post', (e) => {
        e.field('id', (f) => f.scalar('uuid').primary());
      })
      .build();
    expect(() =>
      mergeSources([
        { namespace: 'a', sourceIR: a },
        { namespace: 'b', sourceIR: b },
      ]),
    ).toThrow(IrValidationError);
  });

  it('preserves input order in ir.sources (determinism)', () => {
    const ir = mergeSources([
      { namespace: 'zeta', sourceIR: makeSource('zeta') },
      { namespace: 'alpha', sourceIR: makeSource('alpha') },
      { namespace: 'mu', sourceIR: makeSource('mu') },
    ]);
    expect(Object.keys(ir.sources)).toEqual(['zeta', 'alpha', 'mu']);
  });
});
