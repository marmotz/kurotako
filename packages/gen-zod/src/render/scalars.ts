/**
 * `FieldType` -> base Zod expression (dialect-aware), before constraints and the
 * list / nullable / optional / default assembly.
 */
import type { FieldType, ScalarType } from '@kurotako/ir';
import type { ZodDialect } from '../dialect.js';
import { enumSchemaName } from '../names.js';

/** Which constraint family applies to a base expression. */
export type BaseClass = 'string' | 'number' | 'other';

const STRING_SCALARS = new Set<ScalarType>([
  'string',
  'uuid',
  'decimal',
  'bytes',
]);
const NUMBER_SCALARS = new Set<ScalarType>(['int', 'float', 'bigint']);

/** The constraint family for a field type (drives `applyConstraints`). */
export function baseClass(type: FieldType): BaseClass {
  if (type.kind !== 'scalar') {
    return 'other';
  }
  if (STRING_SCALARS.has(type.scalar)) {
    return 'string';
  }
  if (NUMBER_SCALARS.has(type.scalar)) {
    return 'number';
  }
  return 'other';
}

function scalarExpr(scalar: ScalarType, dialect: ZodDialect): string {
  switch (scalar) {
    case 'string':
    case 'decimal':
    case 'bytes':
      return 'z.string()';
    case 'boolean':
      return 'z.boolean()';
    case 'int':
      return dialect.scalarInt();
    case 'bigint':
      return 'z.bigint()';
    case 'float':
      return 'z.number()';
    case 'date':
    case 'datetime':
      return 'z.coerce.date()';
    case 'uuid':
      return dialect.scalarUuid();
    case 'json':
      return 'z.unknown()';
  }
}

/** Base Zod expression for a field type. Enum -> `<Enum>Schema`. */
export function baseExpr(type: FieldType, dialect: ZodDialect): string {
  switch (type.kind) {
    case 'scalar':
      return scalarExpr(type.scalar, dialect);
    case 'enum':
      return enumSchemaName(type.ref);
    case 'unknown':
      return 'z.unknown()';
  }
}

/** Trailing `// unknown[: hint]` comment for an `unknown` field type, else null. */
export function unknownHintComment(type: FieldType): string | null {
  if (type.kind !== 'unknown') {
    return null;
  }
  return type.hint === undefined ? '// unknown' : `// unknown: ${type.hint}`;
}
