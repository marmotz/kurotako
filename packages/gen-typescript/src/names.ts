/**
 * Deterministic identifier and module-specifier helpers.
 *
 * Identifiers are never namespace-prefixed; the namespace only drives the
 * output sub-tree, taken from `GenerateContext.segment` (`typescript` at the top level).
 */

/** PascalCase variant token embedded in a type identifier. */
export type Variant = '' | 'Create' | 'Update' | 'Where' | 'Select';

/** Relation family token embedded in a type identifier. */
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

/** `${Entity}${Variant}${Family}Dto`. */
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

/** Enum type alias — shares the name with `enumConst` in TypeScript's type namespace. */
export function enumTypeName(name: string): string {
  return name;
}

// --- module specifiers (POSIX, extension-less) -------------------------------

/*
 * `segment` is `GenerateContext.segment`: `typescript` when the generator runs as a
 * top-level entry, a nested path when it runs as a private dependency.
 */

/** `${ns}/${segment}/${entity}.type`. */
export function entityModule(
  namespace: string,
  segment: string,
  entity: string,
): string {
  return `${namespace}/${segment}/${entity}.type`;
}

/** `${ns}/${segment}/enums`. */
export function enumsModule(namespace: string, segment: string): string {
  return `${namespace}/${segment}/enums`;
}

/** `${ns}/${segment}/filters`. */
export function filtersModule(namespace: string, segment: string): string {
  return `${namespace}/${segment}/filters`;
}

/** `${ns}/${segment}/scalars`. */
export function scalarsModule(namespace: string, segment: string): string {
  return `${namespace}/${segment}/scalars`;
}

/** `${ns}/${segment}` — this generator's own barrel. */
export function barrelModule(namespace: string, segment: string): string {
  return `${namespace}/${segment}`;
}
