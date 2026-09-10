/**
 * Union / ref control support for `render/controls.ts` and `render/reactive.ts`.
 *
 * Two shapes come out of a `{ kind: 'union' }` field:
 *
 * - **Discriminated sub-`FormGroup`** — `discriminator.mapping` is present and
 *   every mapped target resolves to an `Entity` in the same source. The field
 *   becomes a `FormGroup` holding a discriminator `FormControl` plus one nested
 *   `FormGroup<<Variant>FormControls>` per discriminator value, built by
 *   delegating to the target entity's own injected `FormFactory` (same
 *   mechanism as `relations: 'deep'`). A runtime switch
 *   (`switchDiscriminatedGroup`) toggles the active sub-group on the
 *   discriminator control's `valueChanges` and rewrites the group's
 *   `getRawValue()` to the flat active-variant shape so the root
 *   `zodValidator` sees a value `z.discriminatedUnion` can parse
 *   (`ir-union-type/technical.md` §8, resolving the `overview.md` open
 *   question).
 * - **Free `FormControl` fallback** — no discriminator, an alias / unresolved
 *   target, a `list` / `nullable` union, or a recursive branch. Emits
 *   `FormControl<A | B>` (`FormControl<unknown>` when a branch is recursive)
 *   plus a `// union: validated by zodValidator(schema)` comment and a
 *   `logger.warn`.
 */
import type { Field, FieldType, SourceIR } from '@kurotako/ir';
import { flattenUnion } from '@kurotako/ir';

/** Resolve a `{ kind: 'ref' }` name to the Zod-emitted DTO / alias type name. */
export type RefTypeName = (ref: string) => string;

export interface DiscriminatedVariant {
  /** The discriminator value this variant is selected by. */
  value: string;
  /** The target entity name (always an `Entity` in the same source). */
  entity: string;
}

export interface DiscriminatedUnion {
  /** The discriminator property name (`z.discriminatedUnion` first arg). */
  discriminator: string;
  /** One entry per `discriminator.mapping` pair, in declaration order. */
  variants: DiscriminatedVariant[];
}

/**
 * A `{ kind: 'union' }` field that qualifies for a discriminated sub-`FormGroup`,
 * or `undefined` when it must fall back to a free `FormControl`.
 */
export function discriminatedUnion(
  field: Field,
  source: SourceIR,
): DiscriminatedUnion | undefined {
  const type = field.type;
  if (type.kind !== 'union' || type.discriminator?.mapping === undefined) {
    return undefined;
  }
  // A `list` / `nullable` discriminated union has no single active sub-object;
  // fall back to a free control.
  if (field.list || field.nullable) {
    return undefined;
  }

  const variants: DiscriminatedVariant[] = [];
  for (const [value, ref] of Object.entries(type.discriminator.mapping)) {
    // Only an entity has its own `FormFactory` to delegate the sub-group to;
    // an alias target (or an unresolved ref) means the free-control fallback.
    if (source.entities[ref] === undefined) {
      return undefined;
    }
    variants.push({ value, entity: ref });
  }
  return variants.length >= 2
    ? { discriminator: type.discriminator.propertyName, variants }
    : undefined;
}

/** Every `{ kind: 'ref' }` name a field type references (recursively). */
function refNames(type: FieldType, into: Set<string> = new Set()): Set<string> {
  if (type.kind === 'ref') {
    into.add(type.ref);
  } else if (type.kind === 'union') {
    for (const variant of type.variants) {
      refNames(variant, into);
    }
  } else if (type.kind === 'map') {
    refNames(type.value, into);
  }
  return into;
}

const SCALAR_BASE: Record<string, string> = {
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

/** TS type text for a single non-union variant. */
function variantType(
  type: FieldType,
  refTypeName: RefTypeName,
  enumTypeName: RefTypeName,
  cyclicRefs: ReadonlySet<string>,
): string {
  switch (type.kind) {
    case 'scalar':
      return SCALAR_BASE[type.scalar] ?? 'unknown';
    case 'enum':
      return enumTypeName(type.ref);
    case 'ref':
      return refTypeName(type.ref);
    case 'unknown':
      return 'unknown';
    case 'map':
      return `Record<string, ${variantType(type.value, refTypeName, enumTypeName, cyclicRefs)}>`;
    case 'union':
      return unionType(type, refTypeName, enumTypeName, cyclicRefs).text;
  }
}

export interface UnionTypeResult {
  /** The `FormControl<T>` type argument, e.g. `string | number`. */
  text: string;
  /** A ref branch chains into a cycle — the control was widened to `unknown`. */
  recursive: boolean;
}

/**
 * The free-`FormControl` type argument for a `{ kind: 'union' }` field: variant
 * types joined with ` | `. A ref branch that names a member of `cyclicRefs` (a
 * `ref` cycle, from `GenerateContext.cycles`) widens the whole control to
 * `unknown` (Angular reactive forms have no lazy control type).
 */
export function unionType(
  type: Extract<FieldType, { kind: 'union' }>,
  refTypeName: RefTypeName,
  enumTypeName: RefTypeName,
  cyclicRefs: ReadonlySet<string> = new Set(),
): UnionTypeResult {
  const variants = flattenUnion(type);
  if (variants.length === 0) {
    return { text: 'unknown', recursive: false };
  }
  const recursive = [...refNames(type)].some((ref) => cyclicRefs.has(ref));
  if (recursive) {
    return { text: 'unknown', recursive: true };
  }
  const text = variants
    .map((variant) => {
      const inner = variantType(variant, refTypeName, enumTypeName, cyclicRefs);
      return variant.kind === 'union' ? `(${inner})` : inner;
    })
    .join(' | ');
  return { text, recursive: false };
}
