/**
 * Compile-only fixture. `tsc -b` type-checks this file; it is not picked up by
 * vitest (no `.test.ts` suffix). It pins that representative `IR` / `SourceIR`
 * literals type-check and that `FieldType` narrows on `kind`.
 */
import type { InferOutput } from 'valibot';
import type { IrSchema } from './schemas.js';
import type { FieldType, IR, SourceIR, TypeAlias } from './types.js';

export const sampleSource: SourceIR = {
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
          name: 'role',
          type: { kind: 'enum', ref: 'Role' },
          list: false,
          optional: false,
          nullable: false,
          constraints: {},
        },
      ],
      relations: [],
      primaryKey: ['id'],
      indexes: [],
      uniques: [],
    },
  },
  enums: {
    Role: { name: 'Role', values: [{ name: 'USER' }, { name: 'ADMIN' }] },
  },
};

export const sampleIr: IR = {
  irVersion: '2',
  sources: { pg: sampleSource },
};

/** A recursive `union` whose one variant is itself a `union`. */
export const recursiveFieldType: FieldType = {
  kind: 'union',
  discriminator: { propertyName: 'kind', mapping: { a: 'A' } },
  variants: [
    { kind: 'ref', ref: 'A' },
    {
      kind: 'union',
      variants: [{ kind: 'scalar', scalar: 'string' }, { kind: 'unknown' }],
    },
  ],
};

export const sampleTypeAlias: TypeAlias = {
  name: 'Shape',
  type: recursiveFieldType,
  doc: 'a union alias',
};

export const sampleSourceWithAliases: SourceIR = {
  ...sampleSource,
  typeAliases: { Shape: sampleTypeAlias },
};

/** `v.InferOutput<typeof IrSchema>` must be assignable to `IR`. */
export const inferredIsIr: IR = null as unknown as InferOutput<typeof IrSchema>;

/** The tagged union narrows on `kind`. */
export function describeFieldType(type: FieldType): string {
  switch (type.kind) {
    case 'scalar':
      return type.scalar;
    case 'enum':
      return type.ref;
    case 'unknown':
      return type.hint ?? 'unknown';
    case 'ref':
      return type.ref;
    case 'union':
      return type.variants.map(describeFieldType).join(' | ');
  }
}
