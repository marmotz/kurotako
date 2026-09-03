/**
 * Prisma field type + native `@db.*` type → IR `FieldType` and `Constraints`.
 *
 * Base scalar mapping is a closed table. Native types refine it: a length
 * argument becomes `maxLength`, `@db.Uuid` / `@db.ObjectId` promote the scalar to
 * `uuid`, `@db.Date` to `date`, `@db.Time` keeps `datetime` but sets
 * `format: 'time'`. Unknown native types are ignored (logged at `debug`).
 */
import type { Logger } from '@kurotako/core';
import type { Constraints, FieldType, ScalarType } from '@kurotako/ir';
import type { PrismaField } from '../dmmf/model.js';

const SCALAR_TABLE: Record<string, ScalarType> = {
  String: 'string',
  Boolean: 'boolean',
  Int: 'int',
  BigInt: 'bigint',
  Float: 'float',
  Decimal: 'decimal',
  DateTime: 'datetime',
  Json: 'json',
  Bytes: 'bytes',
};

const LENGTH_NATIVE = new Set(['VarChar', 'Char', 'NVarChar', 'String']);
const UUID_NATIVE = new Set(['Uuid', 'ObjectId']);
/** Native types that are known and deliberately have no effect in v1. */
const NOOP_NATIVE = new Set([
  'Text',
  'Citext',
  'Xml',
  'Bit',
  'VarBit',
  'Inet',
  'Line',
  'LongText',
  'MediumText',
  'TinyText',
  'SmallInt',
  'MediumInt',
  'UnsignedInt',
  'UnsignedBigInt',
  'Money',
  'Real',
  'DoublePrecision',
  'Decimal',
  'Numeric',
  'SmallMoney',
  'Timestamp',
  'Timestamptz',
  'DateTime2',
  'DateTimeOffset',
]);

export interface MappedFieldType {
  type: FieldType;
  constraints: Constraints;
  scalarOverride?: ScalarType;
}

function refineNative(
  native: [string, string[]],
  constraints: Constraints,
  result: MappedFieldType,
  field: PrismaField,
  logger: Logger | undefined,
): void {
  const [name, args] = native;
  if (LENGTH_NATIVE.has(name)) {
    const n = Number(args[0]);
    if (Number.isFinite(n)) {
      constraints.maxLength = n;
    }
    return;
  }
  if (UUID_NATIVE.has(name)) {
    result.scalarOverride = 'uuid';
    return;
  }
  if (name === 'Date') {
    result.scalarOverride = 'date';
    return;
  }
  if (name === 'Time' || name === 'Timetz') {
    constraints.format = 'time';
    return;
  }
  if (NOOP_NATIVE.has(name)) {
    return;
  }
  logger?.debug(`prisma parser: ignoring unmapped native type @db.${name}`, {
    field: field.name,
  });
}

export function mapFieldType(
  field: PrismaField,
  logger?: Logger,
): MappedFieldType {
  const constraints: Constraints = {};

  if (field.kind === 'unsupported') {
    return { type: { kind: 'unknown', hint: field.type }, constraints };
  }
  if (field.kind === 'enum') {
    return { type: { kind: 'enum', ref: field.type }, constraints };
  }

  const scalar = SCALAR_TABLE[field.type];
  if (scalar === undefined) {
    return { type: { kind: 'unknown', hint: field.type }, constraints };
  }

  const result: MappedFieldType = {
    type: { kind: 'scalar', scalar },
    constraints,
  };
  if (field.nativeType) {
    refineNative(field.nativeType, constraints, result, field, logger);
  }
  return result;
}
