import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { FieldTypeSchema, SourceIrSchema, TypeAliasSchema } from './schemas.js';
import type { FieldType, SourceIR } from './types.js';

/** `parse` then a JSON round-trip must be stable. */
function roundTrips<T>(schema: v.GenericSchema<T>, value: unknown): void {
  const parsed = v.parse(schema, value);
  expect(JSON.parse(JSON.stringify(parsed))).toEqual(parsed);
}

describe('FieldTypeSchema — ref / union', () => {
  it('accepts a { kind: ref } type', () => {
    roundTrips(FieldTypeSchema, { kind: 'ref', ref: 'Address' });
  });

  it('accepts a flat union', () => {
    roundTrips(FieldTypeSchema, {
      kind: 'union',
      variants: [
        { kind: 'scalar', scalar: 'string' },
        { kind: 'ref', ref: 'Address' },
      ],
    });
  });

  it('accepts a nested union', () => {
    roundTrips(FieldTypeSchema, {
      kind: 'union',
      variants: [
        { kind: 'scalar', scalar: 'string' },
        {
          kind: 'union',
          variants: [
            { kind: 'ref', ref: 'A' },
            { kind: 'ref', ref: 'B' },
          ],
        },
      ],
    });
  });

  it('accepts a discriminated union', () => {
    roundTrips(FieldTypeSchema, {
      kind: 'union',
      discriminator: { propertyName: 'kind', mapping: { a: 'A', b: 'B' } },
      variants: [
        { kind: 'ref', ref: 'A' },
        { kind: 'ref', ref: 'B' },
      ],
    });
  });

  it('does not enforce a minimum variant count (tolerated on read)', () => {
    expect(v.is(FieldTypeSchema, { kind: 'union', variants: [] })).toBe(true);
  });

  it('narrows on kind at the type level', () => {
    const type = v.parse(FieldTypeSchema, {
      kind: 'union',
      variants: [
        { kind: 'ref', ref: 'A' },
        { kind: 'ref', ref: 'B' },
      ],
    }) as FieldType;
    if (type.kind === 'union') {
      expect(type.variants).toHaveLength(2);
    }
  });
});

describe('TypeAliasSchema', () => {
  it('round-trips an alias over a union', () => {
    roundTrips(TypeAliasSchema, {
      name: 'Shape',
      doc: 'a shape',
      type: {
        kind: 'union',
        variants: [
          { kind: 'ref', ref: 'Circle' },
          { kind: 'ref', ref: 'Square' },
        ],
      },
    });
  });
});

describe('SourceIrSchema — typeAliases', () => {
  const base: SourceIR = {
    namespace: 'pg',
    parser: 'prisma',
    entities: {},
    enums: {},
  };

  it('accepts a source without typeAliases', () => {
    roundTrips(SourceIrSchema, base);
    expect(v.parse(SourceIrSchema, base)).not.toHaveProperty('typeAliases');
  });

  it('round-trips a source carrying typeAliases', () => {
    roundTrips(SourceIrSchema, {
      ...base,
      typeAliases: {
        Coords: {
          name: 'Coords',
          type: { kind: 'scalar', scalar: 'json' },
        },
      },
    });
  });
});
