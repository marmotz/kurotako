/**
 * Deterministic identifier and module-specifier helpers.
 *
 * Identifiers are never namespace-prefixed (ADR-0004); the namespace only drives
 * the output location. The `react-tanstack/` sub-tree segment on every module
 * specifier is the output-modes rule (one sub-tree per generator).
 */

/** Which Zod variant a hook is built on. */
export type Variant = 'full' | 'create' | 'update';

/** PascalCase variant token embedded in an identifier (`''` for the full shape). */
export function variantToken(variant: Variant): '' | 'Create' | 'Update' {
  switch (variant) {
    case 'full':
      return '';
    case 'create':
      return 'Create';
    case 'update':
      return 'Update';
  }
}

/** `use${Entity}${Variant}Form`. */
export function hookName(entity: string, variant: Variant): string {
  return `use${entity}${variantToken(variant)}Form`;
}

/** `Use${Entity}${Variant}FormOptions`. */
export function optionsTypeName(entity: string, variant: Variant): string {
  return `Use${entity}${variantToken(variant)}FormOptions`;
}

/** `${Entity}${Variant}FormValues` — the form values type. */
export function valuesTypeName(entity: string, variant: Variant): string {
  return `${entity}${variantToken(variant)}FormValues`;
}

/** `${Entity}${Variant}FormApi` — the form instance type. */
export function apiTypeName(entity: string, variant: Variant): string {
  return `${entity}${variantToken(variant)}FormApi`;
}

/** `default${Entity}${Variant}FormValues`. */
export function defaultValuesName(entity: string, variant: Variant): string {
  return `default${entity}${variantToken(variant)}FormValues`;
}

// --- module specifiers (POSIX, extension-less) -------------------------------

/** `${ns}/react-tanstack/${entity}.form`. */
export function entityModule(namespace: string, entity: string): string {
  return `${namespace}/react-tanstack/${entity}.form`;
}

/** `${ns}/react-tanstack/form.runtime`. */
export function runtimeModule(namespace: string): string {
  return `${namespace}/react-tanstack/form.runtime`;
}

/** `${ns}/react-tanstack` — this generator's own sub-tree barrel. */
export function barrelModule(namespace: string): string {
  return `${namespace}/react-tanstack`;
}
