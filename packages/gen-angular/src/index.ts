/**
 * `@kurotako/gen-angular` — the Angular forms generator driver.
 *
 * Maps the IR + the `gen-zod` artifact to typed reactive `FormGroup`s and
 * Signal Forms `schema` + model factories, per namespace. Single entry point:
 * the driver object, its options schema/type, the artifact-extra type and the
 * error classes.
 */
export type { AngularArtifactExtra } from './artifact.js';
export {
  AngularGenError,
  MissingZodNamespaceError,
  MissingZodSymbolError,
} from './errors.js';
export { angularGenerator } from './generator.js';
export { AngularGeneratorOptions } from './options.js';
