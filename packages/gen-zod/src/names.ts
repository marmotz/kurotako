/**
 * Deterministic identifier and module-specifier helpers.
 *
 * Identifiers are never namespace-prefixed (ADR-0004); the namespace only drives
 * the output location. The sub-tree segment on every module specifier comes from
 * `GenerateContext.segment` (one sub-tree per generator, nested when private).
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

/** `${Name}Schema` — the schema `const` for a type alias. */
export function aliasSchemaName(name: string): string {
  return `${name}Schema`;
}

/** Type alias TS name — the alias name verbatim (identifiers never prefixed). */
export function aliasTypeName(name: string): string {
  return name;
}

/**
 * `${Name}Schema` for a bare `{ kind: 'ref' }` — an entity flat schema and a
 * type alias schema share this spelling, only their import module differs.
 */
export function refSchemaName(name: string): string {
  return `${name}Schema`;
}

// --- module specifiers (POSIX, extension-less) -------------------------------

/*
 * `segment` is `GenerateContext.segment`: `zod` when the generator runs as a
 * top-level entry, `angular/zod` when it runs as a private dependency of
 * `gen-angular`.
 */

/** `${ns}/${segment}/${entity}.schema`. */
export function entityModule(
  namespace: string,
  segment: string,
  entity: string,
): string {
  return `${namespace}/${segment}/${entity}.schema`;
}

/** `${ns}/${segment}/enums`. */
export function enumsModule(namespace: string, segment: string): string {
  return `${namespace}/${segment}/enums`;
}

/** `${ns}/${segment}/filters`. */
export function filtersModule(namespace: string, segment: string): string {
  return `${namespace}/${segment}/filters`;
}

/** `${ns}/${segment}/aliases`. */
export function aliasModule(namespace: string, segment: string): string {
  return `${namespace}/${segment}/aliases`;
}

/** `${ns}/${segment}` — this generator's own barrel. */
export function barrelModule(namespace: string, segment: string): string {
  return `${namespace}/${segment}`;
}
