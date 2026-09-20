import { describe, expect, it } from 'vitest';
import {
  createFields,
  defaultValueExpr,
  flattenUnion,
  formInitExpr,
  getSource,
  isCreateOptional,
  isCrossSource,
  isDbAssigned,
  iterEntities,
  iterFields,
  iterTypeAliases,
  nonRedundantTypeAliases,
  primaryKeyFields,
  refCycleMembers,
  resolveEntity,
  resolveEnum,
  resolveRef,
  resolveRelationTarget,
  resolveTypeAlias,
  scalarTsType,
  updateFields,
} from './helpers.js';
import type {
  Entity,
  EnumDef,
  Field,
  FieldType,
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
  irVersion: '4',
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

  it('scalarTsType: ref is verbatim, union is joined with " | "', () => {
    expect(scalarTsType({ kind: 'ref', ref: 'Address' })).toBe('Address');
    expect(
      scalarTsType({
        kind: 'union',
        variants: [
          { kind: 'scalar', scalar: 'string' },
          { kind: 'ref', ref: 'Address' },
          { kind: 'scalar', scalar: 'int' },
        ],
      }),
    ).toBe('string | Address | number');
  });

  it('scalarTsType renders recursive maps', () => {
    expect(
      scalarTsType({
        kind: 'map',
        value: { kind: 'map', value: { kind: 'scalar', scalar: 'int' } },
      }),
    ).toBe('Record<string, Record<string, number>>');
  });

  it('scalarTsType renders arrays, parenthesising a union element', () => {
    expect(
      scalarTsType({ kind: 'array', element: { kind: 'ref', ref: 'Task' } }),
    ).toBe('Task[]');
    expect(
      scalarTsType({
        kind: 'array',
        element: {
          kind: 'array',
          element: { kind: 'scalar', scalar: 'int' },
        },
      }),
    ).toBe('number[][]');
    expect(
      scalarTsType({
        kind: 'array',
        element: {
          kind: 'union',
          variants: [
            { kind: 'scalar', scalar: 'string' },
            { kind: 'scalar', scalar: 'int' },
          ],
        },
      }),
    ).toBe('(string | number)[]');
  });

  it('defaultValueExpr: bigint scalar renders an unquoted bigint literal', () => {
    const bigintType: FieldType = { kind: 'scalar', scalar: 'bigint' };
    expect(defaultValueExpr(bigintType, '0')).toBe('0n');
    expect(defaultValueExpr(bigintType, '-5')).toBe('-5n');
    expect(defaultValueExpr(bigintType, '9223372036854775807')).toBe(
      '9223372036854775807n',
    );
  });

  it('defaultValueExpr: every other scalar renders via JSON.stringify', () => {
    expect(defaultValueExpr({ kind: 'scalar', scalar: 'int' }, 7)).toBe('7');
    expect(defaultValueExpr({ kind: 'scalar', scalar: 'boolean' }, false)).toBe(
      'false',
    );
    expect(defaultValueExpr({ kind: 'scalar', scalar: 'string' }, 'x')).toBe(
      '"x"',
    );
  });
});

describe('formInitExpr', () => {
  const scalar = (s: ScalarType, over: Partial<Field> = {}): Field =>
    field('x', { type: { kind: 'scalar', scalar: s }, ...over });

  it('a literal default wins', () => {
    expect(
      formInitExpr(
        scalar('boolean', { default: { kind: 'value', value: false } }),
      ),
    ).toBe('false');
  });

  it('a bigint literal default is a bigint, not a string', () => {
    expect(
      formInitExpr(
        scalar('bigint', { default: { kind: 'value', value: '0' } }),
      ),
    ).toBe('0n');
  });

  it('an expr default falls through to the type zero', () => {
    expect(
      formInitExpr(
        scalar('datetime', { default: { kind: 'expr', expr: 'now()' } }),
      ),
    ).toBe('new Date(0)');
  });

  it('a nullable field with no default is null', () => {
    expect(formInitExpr(scalar('datetime', { nullable: true }))).toBe('null');
  });

  it('a literal default wins over nullable', () => {
    expect(
      formInitExpr(
        scalar('int', {
          nullable: true,
          default: { kind: 'value', value: 3 },
        }),
      ),
    ).toBe('3');
  });

  it.each<[ScalarType, string]>([
    ['string', "''"],
    ['uuid', "''"],
    ['decimal', "''"],
    ['bytes', "''"],
    ['int', '0'],
    ['float', '0'],
    ['bigint', '0n'],
    ['boolean', 'false'],
    ['date', 'new Date(0)'],
    ['datetime', 'new Date(0)'],
    ['json', 'undefined'],
  ])('zero value for %s', (s, expected) => {
    expect(formInitExpr(scalar(s))).toBe(expected);
  });

  it('a list field is an empty array, or its literal default', () => {
    expect(formInitExpr(scalar('string', { list: true }))).toBe('[]');
    expect(
      formInitExpr(
        scalar('string', {
          list: true,
          default: { kind: 'value', value: ['a'] },
        }),
      ),
    ).toBe('["a"]');
  });

  it('an array field is an empty array', () => {
    expect(
      formInitExpr(
        field('x', {
          type: { kind: 'array', element: { kind: 'ref', ref: 'Task' } },
        }),
      ),
    ).toBe('[]');
  });

  it('a map field is an empty object', () => {
    expect(
      formInitExpr(
        field('x', {
          type: { kind: 'map', value: { kind: 'scalar', scalar: 'int' } },
        }),
      ),
    ).toBe('{}');
  });

  it('an enum field is the resolved first member literal', () => {
    const f = field('x', { type: { kind: 'enum', ref: 'Role' } });
    expect(formInitExpr(f, () => 'ADMIN')).toBe('"ADMIN"');
  });

  it('an enum field with no resolver (or an unresolved ref) is undefined', () => {
    const f = field('x', { type: { kind: 'enum', ref: 'Role' } });
    expect(formInitExpr(f)).toBe('undefined');
    expect(formInitExpr(f, () => undefined)).toBe('undefined');
  });

  it('an unknown field is undefined', () => {
    expect(formInitExpr(field('x', { type: { kind: 'unknown' } }))).toBe(
      'undefined',
    );
  });

  it('a ref field is undefined (no synthesisable zero)', () => {
    expect(
      formInitExpr(field('x', { type: { kind: 'ref', ref: 'Address' } })),
    ).toBe('undefined');
  });

  it('a non-discriminated union field is undefined', () => {
    expect(
      formInitExpr(
        field('x', {
          type: {
            kind: 'union',
            variants: [
              { kind: 'scalar', scalar: 'string' },
              { kind: 'scalar', scalar: 'int' },
            ],
          },
        }),
      ),
    ).toBe('undefined');
  });
});

describe('union type helpers', () => {
  const aliasSource: SourceIR = {
    namespace: 'pg',
    parser: 'prisma',
    entities: {
      Address: {
        name: 'Address',
        fields: [],
        relations: [],
        indexes: [],
        uniques: [],
      },
    },
    enums: {},
    typeAliases: {
      Contact: { name: 'Contact', type: { kind: 'scalar', scalar: 'string' } },
    },
  };

  it('resolveRef: entity wins over alias, alias otherwise, undefined on miss', () => {
    expect(resolveRef(aliasSource, 'Address')).toBe(
      aliasSource.entities.Address,
    );
    expect(resolveRef(aliasSource, 'Contact')).toBe(
      aliasSource.typeAliases?.Contact,
    );
    expect(resolveRef(aliasSource, 'Ghost')).toBeUndefined();
    expect(resolveTypeAlias(aliasSource, 'Address')).toBeUndefined();
    expect(resolveTypeAlias(aliasSource, 'Contact')).toBe(
      aliasSource.typeAliases?.Contact,
    );
  });

  it('iterTypeAliases yields every alias with its namespace', () => {
    const ir: IR = { irVersion: '4', sources: { pg: aliasSource } };
    expect([...iterTypeAliases(ir)].map((a) => a.alias.name)).toEqual([
      'Contact',
    ]);
  });

  it('flattenUnion inlines nested unions and dedupes structurally', () => {
    expect(
      flattenUnion({
        kind: 'union',
        variants: [
          { kind: 'scalar', scalar: 'string' },
          {
            kind: 'union',
            variants: [
              { kind: 'scalar', scalar: 'string' },
              { kind: 'ref', ref: 'Address' },
            ],
          },
          { kind: 'ref', ref: 'Address' },
        ],
      }),
    ).toEqual([
      { kind: 'scalar', scalar: 'string' },
      { kind: 'ref', ref: 'Address' },
    ]);
  });

  it('nonRedundantTypeAliases excludes an enum self-alias, keeps a same-named non-self alias and every other alias', () => {
    const source: SourceIR = {
      namespace: 'pg',
      parser: 'test',
      entities: {},
      enums: { Status: { name: 'Status', values: [{ name: 'A' }] } },
      typeAliases: {
        Status: { name: 'Status', type: { kind: 'enum', ref: 'Status' } },
        Contact: {
          name: 'Contact',
          type: { kind: 'scalar', scalar: 'string' },
        },
      },
    };
    expect(nonRedundantTypeAliases(source).map((a) => a.name)).toEqual([
      'Contact',
    ]);

    const genuineCollision: SourceIR = {
      namespace: 'pg',
      parser: 'test',
      entities: {},
      enums: { Status: { name: 'Status', values: [{ name: 'A' }] } },
      typeAliases: {
        Status: { name: 'Status', type: { kind: 'scalar', scalar: 'string' } },
      },
    };
    expect(
      nonRedundantTypeAliases(genuineCollision).map((a) => a.name),
    ).toEqual(['Status']);
  });

  it('refCycleMembers reports every entity / alias on a ref cycle, and nothing else', () => {
    const source: SourceIR = {
      namespace: 'geo',
      parser: 'test',
      entities: {
        Circle: {
          name: 'Circle',
          fields: [],
          relations: [],
          indexes: [],
          uniques: [],
        },
        Group: {
          name: 'Group',
          fields: [
            {
              name: 'child',
              type: { kind: 'ref', ref: 'Shape' },
              list: false,
              optional: false,
              nullable: false,
              constraints: {},
            },
          ],
          relations: [],
          indexes: [],
          uniques: [],
        },
      },
      enums: {},
      typeAliases: {
        Scalar: { name: 'Scalar', type: { kind: 'scalar', scalar: 'int' } },
        Shape: {
          name: 'Shape',
          type: {
            kind: 'union',
            variants: [
              { kind: 'ref', ref: 'Circle' },
              { kind: 'ref', ref: 'Group' },
            ],
          },
        },
      },
    };
    expect(refCycleMembers(source)).toEqual(new Set(['Shape', 'Group']));
  });
});
