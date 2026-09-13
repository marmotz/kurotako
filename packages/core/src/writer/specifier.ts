/**
 * Extension-qualified relative specifiers for generated code. `moduleResolution:
 * node16`/`nodenext` requires relative imports to carry an explicit extension;
 * generators build specifiers by string concatenation, so these two helpers are
 * the single place that decides what that extension looks like.
 */

/** './aliases' -> './aliases.js'. For a specifier pointing at a sibling file. */
export function jsFile(specifier: string): string {
  return `${specifier}.js`;
}

/** './zod' -> './zod/index.js'. For a specifier pointing at a sibling directory's barrel. */
export function jsIndex(specifier: string): string {
  return `${specifier}/index.js`;
}
