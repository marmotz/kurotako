import { describe, expect, it } from 'vitest';
import {
  createFields,
  getSource,
  isCreateOptional,
  isCrossSource,
  isDbAssigned,
  iterEntities,
  iterFields,
  primaryKeyFields,
  resolveEntity,
  resolveEnum,
  resolveRelationTarget,
  scalarTsType,
  updateFields,
} from './helpers.js';
import type {
  Entity,
  EnumDef,
  Field,
  IR,
  Relation,
  ScalarType,
  SourceIR,
} from './types.js';

const roleSourceLevel: EnumDef = {
  name: 'Status',
  values: [{ name: 'SRC_A' }, { name: 'SRC_B' }],
};
const roleEntityLevel: EnumDef = {
  name: 'Status',
  values: [{ name: 'LOCAL_A' }],
};

const ir: IR = {
  irVersion: '1',
  sources: {
    pg: {
      namespace: 'pg',
      parser: 'prisma',
      entities: {
        User: {
          name: 'User',
          fields: [
            {
              name: 'id',
              type: { kind: 'scalar', scalar: 'uuid' },
              list: false,
              optional: false,
              nullable: false,
              constraints: {},
            },
            {
              name: 'tenantId',
              type: { kind: 'scalar', scalar: 'uuid' },
              list: false,
              optional: false,
              nullable: false,
              constraints: {},
            },
          ],
          relations: [],
          enums: { Status: roleEntityLevel },
          primaryKey: ['tenantId', 'id'],
          indexes: [],
          uniques: [],
        },
      },
      enums: { Status: roleSourceLevel },
    },
  },
};

function pg(): SourceIR {
  const s = ir.sources.pg;
  if (!s) throw new Error('fixture');
  return s;
}

describe('helpers', () => {
  it('getSource / resolveEntity', () => {
    expect(getSource(ir, 'pg')?.parser).toBe('prisma');
    expect(getSource(ir, 'missing')).toBeUndefined();
    expect(resolveEntity(ir, 'pg', 'User')?.name).toBe('User');
    expect(resolveEntity(ir, 'pg', 'Ghost')).toBeUndefined();
  });

  it('resolveEnum: entity-local shadows source-level of the same name', () => {
    const user = resolveEntity(ir, 'pg', 'User');
    expect(resolveEnum(pg(), user, 'Status')).toBe(roleEntityLevel);
    expect(resolveEnum(pg(), undefined, 'Status')).toBe(roleSourceLevel);
    expect(resolveEnum(pg(), user, 'Nope')).toBeUndefined();
  });

  it('resolveRelationTarget / isCrossSource: absent namespace', () => {
    const rel: Relation = {
      name: 'x',
      target: { namespace: '', entity: 'Elsewhere' },
      cardinality: 'one',
      optional: false,
      owning: false,
    };
    expect(isCrossSource('pg', rel)).toBe(true);
    expect(resolveRelationTarget(ir, 'pg', rel)).toBeUndefined();
  });

  it('resolveRelationTarget / isCrossSource: same namespace', () => {
    const rel: Relation = {
      name: 'self',
      target: { namespace: 'pg', entity: 'User' },
      cardinality: 'one',
      optional: false,
      owning: false,
    };
    expect(isCrossSource('pg', rel)).toBe(false);
    expect(resolveRelationTarget(ir, 'pg', rel)?.name).toBe('User');
  });

  it('iterEntities / iterFields', () => {
    expect([...iterEntities(ir)].map((e) => e.entity.name)).toEqual(['User']);
    const user = resolveEntity(ir, 'pg', 'User');
    if (!user) throw new Error('fixture');
    expect([...iterFields(user)].map((f) => f.name)).toEqual([
      'id',
      'tenantId',
    ]);
  });

  it('primaryKeyFields returns fields in primaryKey order', () => {
    const user = resolveEntity(ir, 'pg', 'User');
    if (!user) throw new Error('fixture');
    expect(primaryKeyFields(user).map((f) => f.name)).toEqual([
      'tenantId',
      'id',
    ]);
  });
});

// --- shared-decision helpers ------------------------------------------------

function field(name: string, over: Partial<Field> = {}): Field {
  return {
    name,
    type: { kind: 'scalar', scalar: 'string' },
    list: false,
    optional: false,
    nullable: false,
    constraints: {},
    ...over,
  };
}

describe('shared-decision helpers', () => {
  it('isDbAssigned: only an expr default', () => {
    expect(isDbAssigned(field('a'))).toBe(false);
    expect(
      isDbAssigned(field('b', { default: { kind: 'value', value: 'x' } })),
    ).toBe(false);
    expect(
      isDbAssigned(field('c', { default: { kind: 'expr', expr: 'uuid()' } })),
    ).toBe(true);
  });

  it('isCreateOptional: optional || has default || db-assigned', () => {
    expect(isCreateOptional(field('a'))).toBe(false);
    expect(isCreateOptional(field('a', { optional: true }))).toBe(true);
    expect(
      isCreateOptional(field('a', { default: { kind: 'value', value: 1 } })),
    ).toBe(true);
    expect(
      isCreateOptional(
        field('a', { default: { kind: 'expr', expr: 'now()' } }),
      ),
    ).toBe(true);
  });

  it('createFields drops only db-assigned primary-key members', () => {
    const entity: Entity = {
      name: 'Post',
      fields: [
        field('id', {
          type: { kind: 'scalar', scalar: 'uuid' },
          default: { kind: 'expr', expr: 'uuid()' },
        }),
        field('slug'),
        field('tenantId', { type: { kind: 'scalar', scalar: 'uuid' } }),
      ],
      relations: [],
      primaryKey: ['tenantId', 'id'],
      indexes: [],
      uniques: [],
    };
    // `id` is db-assigned + PK -> dropped; `tenantId` is PK but caller-supplied -> kept.
    expect(createFields(entity).map((f) => f.name)).toEqual([
      'slug',
      'tenantId',
    ]);
    expect(updateFields(entity).map((f) => f.name)).toEqual(['slug']);
  });

  it('scalarTsType mapping table', () => {
    const table: [ScalarType, string][] = [
      ['string', 'string'],
      ['uuid', 'string'],
      ['decimal', 'string'],
      ['boolean', 'boolean'],
      ['int', 'number'],
      ['float', 'number'],
      ['bigint', 'bigint'],
      ['date', 'Date'],
      ['datetime', 'Date'],
      ['bytes', 'Uint8Array'],
      ['json', 'JsonValue'],
    ];
    for (const [scalar, expected] of table) {
      expect(scalarTsType({ kind: 'scalar', scalar })).toBe(expected);
    }
    expect(scalarTsType({ kind: 'enum', ref: 'Role' })).toBe('Role');
    expect(scalarTsType({ kind: 'unknown' })).toBe('unknown');
  });
});
