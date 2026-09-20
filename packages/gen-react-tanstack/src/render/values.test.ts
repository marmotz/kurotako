import { createSourceIR, refCycleMembers, type SourceIR } from '@kurotako/ir';
import { describe, expect, it } from 'vitest';
import { ImportsRecorder } from './imports.js';
import {
  cutFields,
  followedRelations,
  isToOneCycle,
  type ValuesContext,
  valuesTypeText,
} from './values.js';

function ctxFor(
  source: SourceIR,
  overrides: Partial<ValuesContext> = {},
): ValuesContext {
  const cycles = new Set<string>();
  for (const member of refCycleMembers(source)) {
    cycles.add(`${source.namespace}.${member}`);
  }
  return {
    namespace: source.namespace,
    source,
    variant: 'full',
    deep: true,
    cycles,
    dto: (name) => ({ typeName: `${name}DeepDto`, module: `m/${name}` }),
    imports: new ImportsRecorder(),
    ...overrides,
  };
}

/** A -> B -> C -> D chain of to-one relations, each also pointing back with a to-many. */
function chainSource(): SourceIR {
  const b = createSourceIR({ namespace: 'n', parser: 'test' });
  const names = ['A', 'B', 'C', 'D'];
  for (const [i, name] of names.entries()) {
    const next = names[i + 1];
    const prev = names[i - 1];
    b.addEntity(name, (t) => {
      t.field('id', (f) => f.scalar('int').primary());
      if (next !== undefined) {
        t.relation('next', (r) => r.to('n', next).one());
      }
      if (prev !== undefined) {
        t.relation('prevs', (r) => r.to('n', prev).many());
      }
    });
  }
  return b.build();
}

function entity(source: SourceIR, name: string) {
  const found = source.entities[name];
  if (found === undefined) {
    throw new Error(`fixture has no entity '${name}'`);
  }
  return found;
}

describe('valuesTypeText', () => {
  it('is the DTO itself when nothing is cut', () => {
    const source = createSourceIR({ namespace: 'n', parser: 'test' })
      .addEntity('Plain', (t) => {
        t.field('name', (f) => f.scalar('string'));
      })
      .build();
    expect(valuesTypeText(entity(source, 'Plain'), ctxFor(source))).toBe(
      'PlainDeepDto',
    );
  });

  it('a field reaching a ref cycle is typed unknown', () => {
    const source = createSourceIR({ namespace: 'n', parser: 'test' })
      .addEntity('Node', (t) => {
        t.field('label', (f) => f.scalar('string'));
        t.field('parent', (f) => f.ref('Node').optional());
      })
      .addEntity('Holder', (t) => {
        t.field('node', (f) => f.ref('Node'));
        t.field('title', (f) => f.scalar('string'));
      })
      .build();
    const ctx = ctxFor(source, { deep: false });
    expect(valuesTypeText(entity(source, 'Node'), ctx)).toBe(
      'Omit<NodeDeepDto, "parent"> & { parent?: unknown }',
    );
    // A ref to a cyclic entity is cut too (transitively recursive).
    expect(valuesTypeText(entity(source, 'Holder'), ctx)).toBe(
      'Omit<HolderDeepDto, "node"> & { node?: unknown }',
    );
    expect([...cutFields(entity(source, 'Holder'), ctx)]).toEqual(['node']);
  });

  it('a relation back to an entity already on the path is left out', () => {
    const source = chainSource();
    // B.prevs -> A is followed, but A.next -> B goes back to the root: left out.
    expect(valuesTypeText(entity(source, 'B'), ctxFor(source))).toBe(
      'Omit<BDeepDto, "next" | "prevs"> & { next: (Omit<CDeepDto, "next" | "prevs"> & { next: Omit<DDeepDto, "prevs"> }); prevs?: Omit<ADeepDto, "next">[] }',
    );
  });

  it('follows relations at most two levels below the root', () => {
    const source = chainSource();
    const text = valuesTypeText(entity(source, 'A'), ctxFor(source));
    // A -> B -> C are spelled out, C.next (-> D) is cut.
    expect(text).toBe(
      'Omit<ADeepDto, "next"> & { next: (Omit<BDeepDto, "next" | "prevs"> & { next: Omit<CDeepDto, "next" | "prevs"> }) }',
    );
  });

  it('a to-many relation is an optional array; update makes every relation optional', () => {
    const source = chainSource();
    const text = valuesTypeText(
      entity(source, 'D'),
      ctxFor(source, { variant: 'update' }),
    );
    expect(text).toContain('prevs?:');
  });

  it('flat mode never spells out relations', () => {
    const source = chainSource();
    expect(
      valuesTypeText(entity(source, 'A'), ctxFor(source, { deep: false })),
    ).toBe('ADeepDto');
  });

  it('records a type import for every DTO it names', () => {
    const source = chainSource();
    const imports = new ImportsRecorder();
    valuesTypeText(entity(source, 'A'), ctxFor(source, { imports }));
    const text = imports.render();
    expect(text).toContain("import type { ADeepDto } from 'm/A';");
    expect(text).toContain("import type { BDeepDto } from 'm/B';");
    expect(text).toContain("import type { CDeepDto } from 'm/C';");
    expect(text).not.toContain('DDeepDto');
  });
});

describe('followedRelations', () => {
  it('lists the relations the root values type spells out', () => {
    const source = chainSource();
    const names = followedRelations(entity(source, 'B'), ctxFor(source)).map(
      (rel) => rel.relation.name,
    );
    expect(names).toEqual(['next', 'prevs']);
  });

  it('is empty in flat mode', () => {
    const source = chainSource();
    expect(
      followedRelations(entity(source, 'B'), ctxFor(source, { deep: false })),
    ).toEqual([]);
  });

  it('skips a self relation', () => {
    const source = createSourceIR({ namespace: 'n', parser: 'test' })
      .addEntity('Tree', (t) => {
        t.field('id', (f) => f.scalar('int').primary());
        t.relation('parent', (r) => r.to('n', 'Tree').one().optional());
      })
      .build();
    expect(followedRelations(entity(source, 'Tree'), ctxFor(source))).toEqual(
      [],
    );
  });
});

describe('isToOneCycle', () => {
  it('detects a target that reaches the entity again through to-one relations', () => {
    const source = createSourceIR({ namespace: 'n', parser: 'test' })
      .addEntity('User', (t) => {
        t.field('id', (f) => f.scalar('int').primary());
        t.relation('profile', (r) => r.to('n', 'Profile').one());
      })
      .addEntity('Profile', (t) => {
        t.field('id', (f) => f.scalar('int').primary());
        t.relation('user', (r) => r.to('n', 'User').one());
      })
      .build();
    expect(isToOneCycle('User', 'Profile', ctxFor(source))).toBe(true);
  });

  it('a to-many hop breaks the cycle', () => {
    const source = chainSource();
    expect(isToOneCycle('A', 'B', ctxFor(source))).toBe(false);
  });
});
