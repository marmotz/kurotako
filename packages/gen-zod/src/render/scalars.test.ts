import type { FieldType, ScalarType } from '@kurotako/ir';
import { describe, expect, it } from 'vitest';
import { dialectFor } from '../dialect.js';
import {
  baseClass,
  baseExpr,
  collectTypeDeps,
  unknownHintComment,
} from './scalars.js';

const scalar = (s: ScalarType) => ({ kind: 'scalar', scalar: s }) as const;

describe('baseExpr — every ScalarType, v4 vs v3', () => {
  const table: Array<[ScalarType, string, string]> = [
    ['string', 'z.string()', 'z.string()'],
    ['boolean', 'z.boolean()', 'z.boolean()'],
    ['int', 'z.int()', 'z.number().int()'],
    ['bigint', 'z.bigint()', 'z.bigint()'],
    ['float', 'z.number()', 'z.number()'],
    ['decimal', 'z.string()', 'z.string()'],
    ['date', 'z.coerce.date()', 'z.coerce.date()'],
    ['datetime', 'z.coerce.date()', 'z.coerce.date()'],
    ['uuid', 'z.uuid()', 'z.string().uuid()'],
    ['bytes', 'z.string()', 'z.string()'],
    ['json', 'z.unknown()', 'z.unknown()'],
  ];
  for (const [s, v4, v3] of table) {
    it(s, () => {
      expect(baseExpr(scalar(s), dialectFor(4))).toBe(v4);
      expect(baseExpr(scalar(s), dialectFor(3))).toBe(v3);
    });
  }
});

describe('baseExpr — enum and unknown', () => {
  it('enum -> <Enum>Schema', () => {
    expect(baseExpr({ kind: 'enum', ref: 'Role' }, dialectFor(4))).toBe(
      'RoleSchema',
    );
  });
  it('unknown -> z.unknown() with hint comment', () => {
    expect(baseExpr({ kind: 'unknown' }, dialectFor(4))).toBe('z.unknown()');
    expect(unknownHintComment({ kind: 'unknown' })).toBe('// unknown');
    expect(unknownHintComment({ kind: 'unknown', hint: 'point' })).toBe(
      '// unknown: point',
    );
    expect(unknownHintComment(scalar('string'))).toBeNull();
  });
});

describe('baseExpr — ref and union', () => {
  const d = dialectFor(4);

  it('ref -> bare <Name>Schema, z.lazy only when the ref is cyclic', () => {
    expect(baseExpr({ kind: 'ref', ref: 'Node' }, d)).toBe('NodeSchema');
    expect(baseExpr({ kind: 'ref', ref: 'Node' }, d, new Set(['Node']))).toBe(
      'z.lazy(() => NodeSchema)',
    );
  });

  it('union -> z.union([...]) over the flattened variants', () => {
    const type: FieldType = {
      kind: 'union',
      variants: [
        { kind: 'scalar', scalar: 'string' },
        { kind: 'scalar', scalar: 'int' },
      ],
    };
    expect(baseExpr(type, d)).toBe('z.union([z.string(), z.int()])');
  });

  it('discriminated union -> z.discriminatedUnion(prop, [...]), lazy per cyclic ref', () => {
    const type: FieldType = {
      kind: 'union',
      variants: [
        { kind: 'ref', ref: 'Cat' },
        { kind: 'ref', ref: 'Dog' },
      ],
      discriminator: { propertyName: 'kind' },
    };
    expect(baseExpr(type, d)).toBe(
      'z.discriminatedUnion("kind", [CatSchema, DogSchema])',
    );
    expect(baseExpr(type, d, new Set(['Dog']))).toBe(
      'z.discriminatedUnion("kind", [CatSchema, z.lazy(() => DogSchema)])',
    );
  });

  it('nested unions are flattened and duplicates dropped', () => {
    const type: FieldType = {
      kind: 'union',
      variants: [
        { kind: 'scalar', scalar: 'string' },
        {
          kind: 'union',
          variants: [
            { kind: 'scalar', scalar: 'string' },
            { kind: 'scalar', scalar: 'boolean' },
          ],
        },
      ],
    };
    expect(baseExpr(type, d)).toBe('z.union([z.string(), z.boolean()])');
  });

  it('degenerate union unfolds: 1 variant -> the variant, 0 -> z.unknown()', () => {
    expect(
      baseExpr(
        { kind: 'union', variants: [{ kind: 'scalar', scalar: 'int' }] },
        d,
      ),
    ).toBe('z.int()');
    expect(baseExpr({ kind: 'union', variants: [] }, d)).toBe('z.unknown()');
  });
});

describe('baseExpr — typed maps', () => {
  it('renders maps recursively and collects nested refs', () => {
    const type: FieldType = {
      kind: 'map',
      value: { kind: 'map', value: { kind: 'ref', ref: 'Address' } },
    };
    expect(baseExpr(type, dialectFor(4))).toBe(
      'z.record(z.string(), z.record(z.string(), AddressSchema))',
    );
    expect([...collectTypeDeps(type).refs]).toEqual(['Address']);
  });
});

describe('baseExpr — array field type', () => {
  it('renders z.array() recursively and collects nested refs', () => {
    const type: FieldType = {
      kind: 'array',
      element: { kind: 'array', element: { kind: 'ref', ref: 'Task' } },
    };
    expect(baseExpr(type, dialectFor(4))).toBe('z.array(z.array(TaskSchema))');
    expect([...collectTypeDeps(type).refs]).toEqual(['Task']);
  });

  it('renders an array of a map value', () => {
    expect(
      baseExpr(
        {
          kind: 'array',
          element: { kind: 'map', value: { kind: 'scalar', scalar: 'string' } },
        },
        dialectFor(4),
      ),
    ).toBe('z.array(z.record(z.string(), z.string()))');
  });
});

describe('collectTypeDeps', () => {
  it('gathers enum schemas and ref names, recursing into unions', () => {
    const deps = collectTypeDeps({
      kind: 'union',
      variants: [
        { kind: 'enum', ref: 'Role' },
        { kind: 'ref', ref: 'Address' },
        { kind: 'scalar', scalar: 'string' },
      ],
    });
    expect([...deps.enums]).toEqual(['RoleSchema']);
    expect([...deps.refs]).toEqual(['Address']);
  });
});

describe('baseClass', () => {
  it('string family', () => {
    for (const s of ['string', 'uuid', 'decimal', 'bytes'] as ScalarType[]) {
      expect(baseClass(scalar(s))).toBe('string');
    }
  });
  it('number family', () => {
    for (const s of ['int', 'float', 'bigint'] as ScalarType[]) {
      expect(baseClass(scalar(s))).toBe('number');
    }
  });
  it('other', () => {
    expect(baseClass(scalar('date'))).toBe('other');
    expect(baseClass({ kind: 'enum', ref: 'Role' })).toBe('other');
    expect(baseClass({ kind: 'ref', ref: 'Node' })).toBe('other');
    expect(baseClass({ kind: 'union', variants: [] })).toBe('other');
  });
});
