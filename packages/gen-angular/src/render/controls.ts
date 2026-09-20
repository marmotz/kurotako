/**
 * `Field` -> typed `FormControl<T>` control-tree text.
 *
 * `T` mirrors the Zod-inferred type of the field, reconstructed from the IR
 * `Field` directly (never by parsing Zod source text) — see
 * `generator-angular/technical.md` §Control type per scalar.
 */
import type {
  Entity,
  EnumZero,
  Field,
  FieldType,
  ScalarType,
  SourceIR,
} from '@kurotako/ir';
import { formInitExpr, resolveEnum } from '@kurotako/ir';
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

/** `EnumZero` backed by the IR: the enum's first declared member, in source order. */
export function enumZeroFromSource(source: SourceIR, entity: Entity): EnumZero {
  return (ref) => resolveEnum(source, entity, ref)?.values[0]?.name;
}

/**
 * The control's initial-value expression: the shared `formInitExpr`, with a
 * `ref` / non-discriminated `union` fallback field (no non-null zero) seeded
 * empty (`null`) instead of `undefined` — its reactive `FormControl` is validated
 * by Zod.
 */
export function initExpr(field: Field, enumZero?: EnumZero): string {
  const expr = formInitExpr(field, enumZero);
  if (
    expr === 'undefined' &&
    !field.list &&
    (field.type.kind === 'ref' || field.type.kind === 'union')
  ) {
    return 'null';
  }
  return expr;
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
/**
 * A `ref` / non-discriminated `union` fallback field has no synthesisable
 * non-null zero (see `zeroValue`), so its `FormControl` is created without
 * `{ nonNullable: true }` and is seeded empty — Angular's `FormControl`
 * constructor makes such a control `T | null`. The declared control type and
 * the seed expression must both admit that `null`, or the interface member and
 * the `new FormControl(...)` call disagree. A `field.nullable` field already
 * carries `| null` through `controlType`; a `list` field is seeded `[]`.
 */
export function emptySeededNullable(field: Field): boolean {
  return (
    !field.nullable &&
    !field.list &&
    (field.type.kind === 'ref' || field.type.kind === 'union')
  );
}

export function controlExpr(
  field: Field,
  typeArg: string,
  sourceExpr: string,
): string {
  if (field.nullable) {
    return `new FormControl<${typeArg}>(${sourceExpr})`;
  }
  // A `ref` / non-discriminated `union` fallback control has no `nonNullable`
  // seed literal — the seed is `init?.x ?? undefined`, coerced to `null` for
  // the empty control; `zodValidator(schema)` is what actually validates it.
  if (field.type.kind === 'union') {
    return `new FormControl<${typeArg} | null>(${sourceExpr}) /* union: validated by zodValidator(schema) */`;
  }
  if (field.type.kind === 'ref') {
    return `new FormControl<${typeArg} | null>(${sourceExpr})`;
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
  const inner = controlType(field, resolvers);
  // `unknown` already admits `null`; only a concrete ref/union type needs the
  // explicit widening to match the empty-seeded `FormControl`.
  const nullable = emptySeededNullable(field) && inner !== 'unknown';
  return {
    name: field.name,
    fullType: `FormControl<${inner}${nullable ? ' | null' : ''}>`,
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
