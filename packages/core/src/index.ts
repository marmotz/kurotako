/**
 * `@kurotako/core` — the orchestrator. `run()` wires parsers and generators
 * through the dependency DAG: parse -> merge -> order -> generate -> collect ->
 * write. Single entry point; see `backlog/features/core-pipeline/technical.md`.
 */
export * from './errors.js';
export { childLogger, noopLogger } from './logger.js';
export { run } from './run.js';
export type * from './types.js';
export type { Writer } from './writer/index.js';
export { directoryWriter, selectWriter } from './writer/index.js';
