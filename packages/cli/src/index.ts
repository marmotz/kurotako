/**
 * `@kurotako/cli` — the `tako` binary. This barrel is the programmatic surface:
 * `runCli()` plus the reporter / error helpers, for embedders and tests.
 */
export { runCli } from './cli.js';
export {
  type ComparePlanToDiskArgs,
  comparePlanToDisk,
  type DriftEntry,
  type DriftKind,
} from './diff.js';
export { ConfigExistsError, renderError } from './errors.js';
export { ConsoleReporter, type ConsoleReporterOptions } from './reporter.js';
export {
  type CheckForUpdateResult,
  checkForUpdate,
  compareVersions,
  getCacheFilePath,
  readCache,
  refreshLatestVersion,
  type VersionCacheEntry,
  writeCache,
} from './version-check.js';
