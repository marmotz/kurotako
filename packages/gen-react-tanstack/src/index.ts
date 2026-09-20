/**
 * `@kurotako/gen-react-tanstack` — the React + TanStack Form generator driver.
 *
 * Maps the IR + the `gen-zod` artifact (a private dependency) to one typed
 * `useXxxForm` hook per entity, per namespace. Single entry point: the driver object,
 * its options schema/type, the artifact-extra type and the error classes.
 */
export type { ReactTanstackArtifactExtra } from './artifact.js';
export {
  MissingZodDependencyError,
  MissingZodSymbolError,
  ReactTanstackGenError,
  UnknownIncludeEntityError,
} from './errors.js';
export { reactTanstackGenerator } from './generator.js';
export type { Variant } from './names.js';
export { ReactTanstackGeneratorOptions } from './options.js';
