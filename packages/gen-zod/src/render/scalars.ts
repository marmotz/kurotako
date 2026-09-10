/**
 * `FieldType` -> base Zod expression (dialect-aware), before constraints and the
 * list / nullable / optional / default assembly.
 */
import type { FieldType, ScalarType, SourceIR } from '@kurotako/ir';
import { flattenUnion, scalarTsType } from '@kurotako/ir';
import type { ZodDialect } from '../dialect.js';
import {
  aliasTypeName,
  enumSchemaName,
  refSchemaName,
  typeName,
} from '../names.js';

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

const NO_CYCLES: ReadonlySet<string> = new Set();

/**
 * Base Zod expression for a field type.
 *
 * - `enum` -> `<Enum>Schema`
 * - `ref` -> a bare `<Name>Schema` forward reference, or `z.lazy(() =>
 *   <Name>Schema)` when the ref name is in `cyclicRefs` (it takes part in a
 *   reference cycle, from `GenerateContext.cycles`). The caller emits aliases in
 *   topological order so a bare reference is always declared before use.
 * - `union` -> `z.union([...])`, or `z.discriminatedUnion('<prop>', [...])` when
 *   a discriminator is set. Variants are flattened (`flattenUnion`); a degenerate
 *   union unfolds to its single variant (0 variants -> `z.unknown()`).
 */
export function baseExpr(
  type: FieldType,
  dialect: ZodDialect,
  cyclicRefs: ReadonlySet<string> = NO_CYCLES,
): string {
  switch (type.kind) {
    case 'scalar':
      return scalarExpr(type.scalar, dialect);
    case 'enum':
      return enumSchemaName(type.ref);
    case 'unknown':
      return 'z.unknown()';
    case 'ref':
      return cyclicRefs.has(type.ref)
        ? `z.lazy(() => ${refSchemaName(type.ref)})`
        : refSchemaName(type.ref);
    case 'map':
      return `z.record(z.string(), ${baseExpr(type.value, dialect, cyclicRefs)})`;
    case 'union': {
      const variants = flattenUnion(type);
      if (variants.length === 0) {
        return 'z.unknown()';
      }
      if (variants.length === 1 && variants[0] !== undefined) {
        return baseExpr(variants[0], dialect, cyclicRefs);
      }
      const exprs = variants
        .map((v) => baseExpr(v, dialect, cyclicRefs))
        .join(', ');
      if (type.discriminator !== undefined) {
        return `z.discriminatedUnion(${JSON.stringify(
          type.discriminator.propertyName,
        )}, [${exprs}])`;
      }
      return `z.union([${exprs}])`;
    }
  }
}

/** Schema identifiers a field type pulls in, split by their owning module. */
export interface TypeDeps {
  /** `<Enum>Schema` names, imported from `./enums`. */
  enums: Set<string>;
  /** Bare `ref` names — resolved to `./aliases` or `./<entity>.schema` by the caller. */
  refs: Set<string>;
}

/** Walk a field type, collecting every enum-schema and `ref` name it references. */
export function collectTypeDeps(
  type: FieldType,
  into: TypeDeps = { enums: new Set(), refs: new Set() },
): TypeDeps {
  switch (type.kind) {
    case 'enum':
      into.enums.add(enumSchemaName(type.ref));
      break;
    case 'ref':
      into.refs.add(type.ref);
      break;
    case 'union':
      for (const variant of type.variants) {
        collectTypeDeps(variant, into);
      }
      break;
    case 'map':
      collectTypeDeps(type.value, into);
      break;
    case 'scalar':
    case 'unknown':
      break;
  }
  return into;
}

/**
 * TS type name for a bare `{ kind: 'ref' }`: an entity flat schema exports its
 * type as `<Name>Dto`, a type alias as `<Name>`.
 */
export function refTypeName(source: SourceIR, ref: string): string {
  return source.entities[ref] !== undefined
    ? typeName(ref)
    : aliasTypeName(ref);
}

/**
 * The gen-zod TS type for a field type. Like the IR's `scalarTsType`, but maps
 * an entity `ref` to `<Name>Dto` (its emitted flat schema type) rather than the
 * bare identifier.
 */
export function typeExpr(type: FieldType, source: SourceIR): string {
  switch (type.kind) {
    case 'ref':
      return refTypeName(source, type.ref);
    case 'union':
      return flattenUnion(type)
        .map((variant) =>
          variant.kind === 'union'
            ? `(${typeExpr(variant, source)})`
            : typeExpr(variant, source),
        )
        .join(' | ');
    case 'map':
      return `Record<string, ${typeExpr(type.value, source)}>`;
    default:
      return scalarTsType(type);
  }
}

/** Trailing `// unknown[: hint]` comment for an `unknown` field type, else null. */
export function unknownHintComment(type: FieldType): string | null {
  if (type.kind !== 'unknown') {
    return null;
  }
  return type.hint === undefined ? '// unknown' : `// unknown: ${type.hint}`;
}
