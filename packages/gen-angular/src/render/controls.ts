/**
 * `Field` -> typed `FormControl<T>` control-tree text.
 *
 * `T` mirrors the Zod-inferred type of the field, reconstructed from the IR
 * `Field` directly (never by parsing Zod source text) — see
 * `generator-angular/technical.md` §Control type per scalar.
 */
import type {
  Entity,
  Field,
  FieldType,
  ScalarType,
  SourceIR,
} from '@kurotako/ir';
import { resolveEnum } from '@kurotako/ir';
import type { Variant } from '../names.js';
import { type RefTypeName, unionType } from './unions.js';

/** Resolve an enum ref (`FieldType.kind === 'enum'`) to the Zod-emitted union type name. */
export type ZodEnumTypeName = (ref: string) => string;

/**
 * Resolvers a field's control type needs beyond its own IR shape: enum refs and
 * `{ kind: 'ref' }` targets both resolve to a Zod-emitted type name, and
 * `cyclicRefs` (`${name}` members of a `ref` cycle, from
 * `GenerateContext.cycles`) lets a recursive union branch be widened.
 */
export interface TypeResolvers {
  enumTypeName: ZodEnumTypeName;
  refTypeName: RefTypeName;
  cyclicRefs: ReadonlySet<string>;
}

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

function typeBase(type: FieldType, resolvers: TypeResolvers): string {
  switch (type.kind) {
    case 'scalar':
      return SCALAR_BASE[type.scalar];
    case 'enum':
      return resolvers.enumTypeName(type.ref);
    case 'unknown':
      return 'unknown';
    case 'ref':
      return resolvers.refTypeName(type.ref);
    case 'map':
      return `Record<string, ${typeBase(type.value, resolvers)}>`;
    case 'array':
      return type.element.kind === 'union'
        ? `(${typeBase(type.element, resolvers)})[]`
        : `${typeBase(type.element, resolvers)}[]`;
    case 'union':
      return unionType(
        type,
        resolvers.refTypeName,
        resolvers.enumTypeName,
        resolvers.cyclicRefs,
      ).text;
  }
}

function baseType(field: Field, resolvers: TypeResolvers): string {
  return typeBase(field.type, resolvers);
}

/** The `FormControl<T>` type argument for a field: `list` wraps, then `nullable`. */
export function controlType(field: Field, resolvers: TypeResolvers): string {
  let t = baseType(field, resolvers);
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
  if (field.type.kind === 'map') {
    return '{}';
  }
  if (field.type.kind === 'array') {
    return '[]';
  }
  // `ref` / non-discriminated `union`: no synthesisable zero — the control type
  // is `RefDto` / `A | B` and the seed is cast (`controlExpr`); `zodValidator`
  // flags the still-empty control until the consumer fills it
  // (`ir-union-type/technical.md` §8).
  return 'undefined';
}

/** The control's initial-value expression: a literal default, else the type's zero. */
export function initExpr(field: Field, enumZero?: EnumZero): string {
  if (field.list || field.type.kind === 'array') {
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
  // A `ref` / non-discriminated `union` fallback control has no `nonNullable`
  // seed literal — the seed is `init?.x ?? undefined`, cast to the exact
  // control type; `zodValidator(schema)` is what actually validates it. The
  // union case also carries a note (the ticket reserves it for the fallback).
  if (field.type.kind === 'union') {
    return `new FormControl<${typeArg}>((${sourceExpr}) as ${typeArg}) /* union: validated by zodValidator(schema) */`;
  }
  if (field.type.kind === 'ref') {
    return `new FormControl<${typeArg}>((${sourceExpr}) as ${typeArg})`;
  }
  return `new FormControl(${sourceExpr}, { nonNullable: true })`;
}

export interface ControlEntry {
  name: string;
  /** The full control-tree member type, e.g. `FormControl<string>` or (deep mode) `FormGroup<PostCreateDeepFormControls>`. */
  fullType: string;
}

/** One `ControlEntry` for a scalar / enum / free-`FormControl` field. */
export function fieldControlEntry(
  field: Field,
  resolvers: TypeResolvers,
): ControlEntry {
  return {
    name: field.name,
    fullType: `FormControl<${controlType(field, resolvers)}>`,
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
