/** `@kurotako/gen-typescript` — the TypeScript generator driver. */
export type { TypeScriptArtifactExtra } from './artifact.js';
export {
  TypeScriptAliasCycleError,
  TypeScriptAliasPublicNameCollisionError,
  TypeScriptEnumCollisionError,
  TypeScriptEnumPublicNameCollisionError,
  TypeScriptGenError,
} from './errors.js';
export { typescriptGenerator } from './generator.js';
