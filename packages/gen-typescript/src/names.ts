/**
 * Deterministic identifier and module-specifier helpers.
 *
 * Identifiers are never namespace-prefixed; the namespace only drives the
 * `typescript/` output sub-tree.
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

/** `${ns}/typescript/${entity}.type`. */
export function entityModule(namespace: string, entity: string): string {
  return `${namespace}/typescript/${entity}.type`;
}

/** `${ns}/typescript/enums`. */
export function enumsModule(namespace: string): string {
  return `${namespace}/typescript/enums`;
}

/** `${ns}/typescript/filters`. */
export function filtersModule(namespace: string): string {
  return `${namespace}/typescript/filters`;
}

/** `${ns}/typescript/scalars`. */
export function scalarsModule(namespace: string): string {
  return `${namespace}/typescript/scalars`;
}

/** `${ns}/typescript` — this generator's own barrel. */
export function barrelModule(namespace: string): string {
  return `${namespace}/typescript`;
}
