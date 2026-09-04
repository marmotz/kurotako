/**
 * Deterministic identifier and module-specifier helpers.
 *
 * Identifiers are never namespace-prefixed (ADR-0004); the namespace only drives
 * the output location. The `angular/` sub-tree segment on every module specifier
 * is the output-modes amendment (one sub-tree per generator).
 */

/** PascalCase form-variant token embedded in an identifier. */
export type Variant = 'Create' | 'Update';

/** Relation family token embedded in a control-tree identifier. */
export type Family = '' | 'Deep';

function lowerFirst(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toLowerCase() + s.slice(1);
}

/** `${Entity}${Variant}${Family}FormControls`. */
export function controlsTypeName(
  entity: string,
  variant: Variant,
  family: Family = '',
): string {
  return `${entity}${variant}${family}FormControls`;
}

/** `${Entity}${Variant}${Family}Form` — the `FormGroup<...>` type alias. */
export function formTypeName(
  entity: string,
  variant: Variant,
  family: Family = '',
): string {
  return `${entity}${variant}${family}Form`;
}

/** `${Entity}FormFactory` — one `@Injectable` service per entity. */
export function factoryName(entity: string): string {
  return `${entity}FormFactory`;
}

/** `create${Variant}Form` — the factory method name. No suffix in deep mode. */
export function factoryMethod(variant: Variant): string {
  return `create${variant}Form`;
}

/**
 * `add${Relation}${Variant}` — the deep-mode nested-control builder method.
 * Variant-suffixed: `UserFormFactory` builds both `Create` and `Update` trees,
 * and a relation's target control type differs between them, so the two
 * variants cannot share one method name (would collide as a duplicate
 * implementation).
 */
export function relationBuilderMethod(
  relationName: string,
  variant: Variant,
): string {
  const cap = `${relationName.charAt(0).toUpperCase()}${relationName.slice(1)}`;
  return `add${cap}${variant}`;
}

/** `${entity}${Variant}FormSchema`, camelCase — the Signal Forms schema const. */
export function signalSchemaName(entity: string, variant: Variant): string {
  return `${lowerFirst(entity)}${variant}FormSchema`;
}

/** `create${Entity}${Variant}Model` — the Signal Forms model-factory function. */
export function modelFactoryName(entity: string, variant: Variant): string {
  return `create${entity}${variant}Model`;
}

/**
 * `create${Entity}${Variant}Form` — the Signal Forms `form(signal(model), schema)`
 * convenience wrapper. Safe to call from anywhere `inject()` would work (a
 * component field initializer or constructor): `form()` resolves its
 * injector from the ambient injection context when none is passed
 * explicitly, same as calling it inline.
 */
export function signalFormFactoryName(
  entity: string,
  variant: Variant,
): string {
  return `create${entity}${variant}Form`;
}

// --- module specifiers (POSIX, extension-less) -------------------------------

/** `${ns}/angular/${entity}.form`. */
export function entityModule(namespace: string, entity: string): string {
  return `${namespace}/angular/${entity}.form`;
}

/** `${ns}/angular/zod-forms.runtime`. */
export function runtimeModule(namespace: string): string {
  return `${namespace}/angular/zod-forms.runtime`;
}

/** `${ns}/angular` — this generator's own sub-tree barrel. */
export function barrelModule(namespace: string): string {
  return `${namespace}/angular`;
}
