/**
 * `@kurotako/gen-zod` — the Zod generator driver.
 *
 * Maps the IR to Zod schema source text (5 variants x 2 relation families, per
 * namespace) and assembles the `GeneratorArtifact` consumed by
 * `@kurotako/gen-angular`. Single entry point: the driver object, its
 * options schema/type, the artifact-extra type and the error classes.
 */
export type { ZodArtifactExtra } from './artifact.js';
export { ZodEnumCollisionError, ZodGenError } from './errors.js';
export { zodGenerator } from './generator.js';
export { ZodGeneratorOptions } from './options.js';
