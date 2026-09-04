/**
 * `Field` -> typed `FormControl<T>` control-tree text.
 *
 * `T` mirrors the Zod-inferred type of the field, reconstructed from the IR
 * `Field` directly (never by parsing Zod source text) — see
 * `generator-angular/technical.md` §Control type per scalar.
 */
import type { Entity, Field, ScalarType, SourceIR } from '@kurotako/ir';
import { resolveEnum } from '@kurotako/ir';
import type { Variant } from '../names.js';

/** Resolve an enum ref (`FieldType.kind === 'enum'`) to the Zod-emitted union type name. */
export type ZodEnumTypeName = (ref: string) => string;

const SCALAR_BASE: Record<ScalarType, string> = {
  string: 'string',
  uuid: 'string',
  decimal: 'string',
  bytes: 'string',
  int: 'number',
  float: 'number',
  bigint: 'bigint',
  boolean: 'boolean',
  date: 'Date',
  datetime: 'Date',
  json: 'unknown',
};

function baseType(field: Field, zodEnumTypeName: ZodEnumTypeName): string {
  switch (field.type.kind) {
    case 'scalar':
      return SCALAR_BASE[field.type.scalar];
    case 'enum':
      return zodEnumTypeName(field.type.ref);
    case 'unknown':
      return 'unknown';
  }
}

/** The `FormControl<T>` type argument for a field: `list` wraps, then `nullable`. */
export function controlType(
  field: Field,
  zodEnumTypeName: ZodEnumTypeName,
): string {
  let t = baseType(field, zodEnumTypeName);
  if (field.list) {
    t = `${t}[]`;
  }
  if (field.nullable) {
    t = `${t} | null`;
  }
  return t;
}

/** Resolve an enum ref to a real member literal for `initExpr`'s enum zero. */
export type EnumZero = (ref: string) => string | undefined;

/** `EnumZero` backed by the IR: the enum's first declared member, in source order. */
export function enumZeroFromSource(source: SourceIR, entity: Entity): EnumZero {
  return (ref) => resolveEnum(source, entity, ref)?.values[0]?.name;
}

/**
 * A valid, always-assignable non-null literal for the field's base type. Never
 * `null` — the Zod-inferred DTO type for a field with no literal default is
 * `T` (required) or `T | undefined` (optional), never `T | null`; only a
 * `field.nullable` field's DTO type includes `null`, and `initExpr` handles
 * that case itself rather than folding it in here.
 */
function zeroValue(field: Field, enumZero?: EnumZero): string {
  if (field.type.kind === 'scalar') {
    switch (field.type.scalar) {
      case 'string':
      case 'uuid':
      case 'decimal':
      case 'bytes':
        return "''";
      case 'int':
      case 'float':
        return '0';
      case 'bigint':
        return '0n';
      case 'boolean':
        return 'false';
      case 'date':
      case 'datetime':
        return 'new Date(0)';
      case 'json':
        // control type is `unknown`: `| undefined` is trivially assignable.
        return 'undefined';
    }
  }
  if (field.type.kind === 'enum') {
    // Unlike a scalar zero, `x ?? undefined` never actually strips
    // `| undefined` from `x`'s type (TS keeps it, since the fallback's own
    // type still includes it) — so a non-nullable enum control with no
    // literal default needs a *real* member literal, not `undefined`, or
    // `new FormControl(..., { nonNullable: true })` fails to type-check
    // against the field's exact union type.
    const value = enumZero?.(field.type.ref);
    return value === undefined ? 'undefined' : JSON.stringify(value);
  }
  return 'undefined';
}

/** The control's initial-value expression: a literal default, else the type's zero. */
export function initExpr(field: Field, enumZero?: EnumZero): string {
  if (field.list) {
    return field.default?.kind === 'value'
      ? JSON.stringify(field.default.value)
      : '[]';
  }
  if (field.default?.kind === 'value') {
    return JSON.stringify(field.default.value);
  }
  if (field.nullable) {
    return 'null';
  }
  return zeroValue(field, enumZero);
}

/**
 * `new FormControl(...)` construction expression for a field.
 * `typeArg` is the field's already-resolved `controlType(...)` text; `sourceExpr`
 * is the value expression to seed the control from (an `init?.x ?? <zero>` for
 * `Create`, a bare `value.x` for `Update` — the caller decides). `sourceExpr` is
 * already `null`-inclusive when `field.nullable` (via `initExpr`'s own fallback,
 * or the Update DTO's own field type) — appending another `?? null` here would
 * be provably-redundant code TS flags as an error (`This expression is never
 * nullish`), not just dead weight.
 */
export function controlExpr(
  field: Field,
  typeArg: string,
  sourceExpr: string,
): string {
  if (field.nullable) {
    return `new FormControl<${typeArg}>(${sourceExpr})`;
  }
  return `new FormControl(${sourceExpr}, { nonNullable: true })`;
}

export interface ControlEntry {
  name: string;
  /** The full control-tree member type, e.g. `FormControl<string>` or (deep mode) `FormGroup<PostCreateDeepFormControls>`. */
  fullType: string;
}

/** One `ControlEntry` for a scalar/enum field: `name: FormControl<T>`. */
export function fieldControlEntry(
  field: Field,
  zodEnumTypeName: ZodEnumTypeName,
): ControlEntry {
  return {
    name: field.name,
    fullType: `FormControl<${controlType(field, zodEnumTypeName)}>`,
  };
}

/** `export interface <Entity><Variant>[Deep]FormControls { ... }` text. */
export function controlsInterface(
  interfaceName: string,
  entries: ControlEntry[],
): string {
  if (entries.length === 0) {
    return `export interface ${interfaceName} {}`;
  }
  const body = entries.map((e) => `  ${e.name}: ${e.fullType};`).join('\n');
  return `export interface ${interfaceName} {\n${body}\n}`;
}

export type { Variant };
