/**
 * IR format version. Orthogonal to the npm semver of `@kurotako/ir`
 * (independent versioning): a single string, bumped only on a breaking change
 * to the format itself.
 */
export const IR_VERSION = '2';

/**
 * Whether an IR produced against `irVersion` can be consumed by this build.
 * v1 rule: strict equality.
 */
export function isCompatible(irVersion: string): boolean {
  return irVersion === IR_VERSION;
}
