/**
 * The no-op `Logger` default and a `childLogger` wrapper that merges a
 * `{ namespace }` / `{ generator }` tag into every call's `meta`.
 */
import type { Logger } from './types.js';

/** Default logger: swallows everything. The CLI injects a real one. */
export const noopLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

function mergeMeta(
  prefixMeta: Record<string, unknown>,
  meta: unknown,
): unknown {
  if (meta === undefined) {
    return { ...prefixMeta };
  }
  if (meta !== null && typeof meta === 'object' && !Array.isArray(meta)) {
    return { ...prefixMeta, ...(meta as Record<string, unknown>) };
  }
  return { ...prefixMeta, value: meta };
}

/**
 * Wrap `base` so every message carries `prefixMeta` (e.g. `{ namespace }` or
 * `{ generator }`) merged into its `meta` argument.
 */
export function childLogger(
  base: Logger,
  prefixMeta: Record<string, unknown>,
): Logger {
  return {
    debug: (msg, meta) => base.debug(msg, mergeMeta(prefixMeta, meta)),
    info: (msg, meta) => base.info(msg, mergeMeta(prefixMeta, meta)),
    warn: (msg, meta) => base.warn(msg, mergeMeta(prefixMeta, meta)),
    error: (msg, meta) => base.error(msg, mergeMeta(prefixMeta, meta)),
  };
}
