/**
 * `@kurotako/core` — the orchestrator. `run()` wires parsers and generators
 * through the dependency DAG: parse -> merge -> order -> generate -> collect ->
 * write. Single entry point; see `backlog/features/core-pipeline/technical.md`.
 */
export * from './errors.js';
export { childLogger, noopLogger } from './logger.js';
export { run } from './run.js';
export type * from './types.js';
export { applyBanner, BANNER, GITATTRIBUTES } from './writer/banner.js';
export { synthesizeRootBarrels } from './writer/barrel.js';
export type { WriteInput, Writer } from './writer/index.js';
export {
  directoryWriter,
  packageWriter,
  selectWriter,
} from './writer/index.js';
export { collectPeerDependencies } from './writer/peers.js';
export type { PackageManager } from './writer/pm.js';
export { resolvePackageManager, runInstall } from './writer/pm.js';
