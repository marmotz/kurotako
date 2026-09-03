/**
 * `@kurotako/config` — resolve, load and validate `tako.config.ts`, and the
 * `defineConfig` helper user config files import. Builds the `@kurotako/core`
 * `ResolvedConfig` the CLI hands to `run()`.
 *
 * See `backlog/features/config-system/technical.md`.
 */
export { defineConfig } from './define.js';
export { defineGenerator, defineParser } from './define-driver.js';
export {
  type ConfigIssue,
  ConfigLoadError,
  ConfigNotFoundError,
  ConfigShapeError,
  DriverOptionsError,
  DuplicateGeneratorError,
  NoDefaultExportError,
  UnknownNamespaceError,
} from './errors.js';
export { type LoadResult, loadConfig } from './load.js';
export { resolveConfigFile } from './resolve.js';
export { NAMESPACE_RE, normalizeIssues, TakoConfigSchema } from './schema.js';
export { CONFIG_TEMPLATE } from './template.js';
export type * from './types.js';
