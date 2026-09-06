import type { IR, SourceIR } from '@kurotako/ir';
import { createSourceIR } from '@kurotako/ir';
import { describe, expect, it } from 'vitest';
import { filterIR } from './filter.js';

function makeSource(namespace: string): SourceIR {
  return createSourceIR({ namespace, parser: 'prisma' })
    .addEntity('User', (e) => {
      e.field('id', (f) => f.scalar('uuid').primary());
    })
    .build();
}

function makeIR(): IR {
  return {
    irVersion: '2',
    sources: {
      a: createSourceIR({ namespace: 'a', parser: 'prisma' })
        .addEntity('User', (e) => {
          e.field('id', (f) => f.scalar('uuid').primary());
          e.relation('posts', (r) =>
            r.to('b', 'Post').many().backRelation('author'),
          );
        })
        .build(),
      b: makeSource('b'),
    },
  };
}

describe('filterIR', () => {
  it('restricts to a single namespace, dropping the others', () => {
    const view = filterIR(makeIR(), ['a']);
    expect(Object.keys(view.sources)).toEqual(['a']);
  });

  it('no restriction returns a full, independent clone', () => {
    const ir = makeIR();
    const view = filterIR(ir);
    expect(Object.keys(view.sources)).toEqual(['a', 'b']);
    view.sources.a?.entities.User?.fields.push({
      name: 'injected',
      type: { kind: 'scalar', scalar: 'string' },
      constraints: {},
    } as never);
    expect(ir.sources.a?.entities.User?.fields).toHaveLength(1);
  });

  it('a cross-namespace relation survives filtering', () => {
    const view = filterIR(makeIR(), ['a']);
    const rel = view.sources.a?.entities.User?.relations[0];
    expect(rel?.target).toEqual({ namespace: 'b', entity: 'Post' });
  });

  it('an unknown namespace in the list is ignored', () => {
    const view = filterIR(makeIR(), ['a', 'ghost']);
    expect(Object.keys(view.sources)).toEqual(['a']);
  });

  it('preserves key order from the merged IR', () => {
    const ir = makeIR();
    const view = filterIR(ir, ['b', 'a']);
    expect(Object.keys(view.sources)).toEqual(['a', 'b']);
  });
});
