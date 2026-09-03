/**
 * Deterministic identifier and module-specifier helpers.
 *
 * Identifiers are never namespace-prefixed (ADR-0004); the namespace only drives
 * the output location. The `zod/` sub-tree segment on every module specifier is
 * the output-modes amendment (one sub-tree per generator).
 */

/** PascalCase variant token embedded in a schema/type identifier. */
export type Variant = '' | 'Create' | 'Update' | 'Where' | 'Select';

/** Relation family token embedded in a schema/type identifier. */
export type Family = '' | 'Deep';

/** The five variant names, in their fixed order. */
export const VARIANTS = [
  'full',
  'create',
  'update',
  'where',
  'select',
] as const;
export type VariantName = (typeof VARIANTS)[number];

/** The two relation families, in their fixed order. */
export const FAMILIES = ['flat', 'deep'] as const;
export type FamilyName = (typeof FAMILIES)[number];

/** `VariantName` -> the PascalCase token used inside identifiers. */
export const VARIANT_TOKEN: Record<VariantName, Variant> = {
  full: '',
  create: 'Create',
  update: 'Update',
  where: 'Where',
  select: 'Select',
};

/** `FamilyName` -> the token used inside identifiers. */
export const FAMILY_TOKEN: Record<FamilyName, Family> = {
  flat: '',
  deep: 'Deep',
};

/** `${Entity}${Variant}${Family}Schema`. */
export function schemaName(
  entity: string,
  variant: Variant = '',
  family: Family = '',
): string {
  return `${entity}${variant}${family}Schema`;
}

/** `${Entity}${Variant}${Family}Dto` — the `z.infer` type alias stem. */
export function typeName(
  entity: string,
  variant: Variant = '',
  family: Family = '',
): string {
  return `${entity}${variant}${family}Dto`;
}

/** Enum `const` array identifier — the resolved `EnumDef` name verbatim. */
export function enumConst(name: string): string {
  return name;
}

/** `${Enum}Schema` — the `z.enum(...)` identifier. */
export function enumSchemaName(name: string): string {
  return `${name}Schema`;
}

/** Enum type alias — shares the name with `enumConst` (distinct TS namespaces). */
export function enumTypeName(name: string): string {
  return name;
}

/** `Enum${Name}Filter` — the Where operator schema for an enum-typed field. */
export function enumFilterName(name: string): string {
  return `Enum${name}Filter`;
}

// --- module specifiers (POSIX, extension-less) -------------------------------

/** `${ns}/zod/${entity}.schema`. */
export function entityModule(namespace: string, entity: string): string {
  return `${namespace}/zod/${entity}.schema`;
}

/** `${ns}/zod/enums`. */
export function enumsModule(namespace: string): string {
  return `${namespace}/zod/enums`;
}

/** `${ns}/zod/filters`. */
export function filtersModule(namespace: string): string {
  return `${namespace}/zod/filters`;
}

/** `${ns}/zod` — this generator's own barrel. */
export function barrelModule(namespace: string): string {
  return `${namespace}/zod`;
}
