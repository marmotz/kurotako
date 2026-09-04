/**
 * Structural Valibot schema for the config. Run *after* the module loads. It
 * does not re-check what TypeScript guarantees for typed configs — it exists for
 * plain-JS / hand-edited / programmatic configs and to turn a bad shape into a
 * located message.
 *
 * Cross-field checks (mode-B requirements, duplicate generator names, unknown
 * namespaces) are not expressible structurally and live in `load.ts`.
 */
import * as v from 'valibot';
import type { ConfigIssue } from './errors.js';

/**
 * A namespace becomes a directory / submodule name and an import-path segment
 * (ADR-0005). Pinned here; referenced by output-modes.
 */
export const NAMESPACE_RE = /^[a-z][a-zA-Z0-9]*$/;

const DriverObject = v.pipe(
  // `looseObject` keeps `parse` / `generate` so the `v.check` below can see them
  // (`v.object` would strip every key it does not declare before the check runs).
  v.looseObject({ name: v.pipe(v.string(), v.minLength(1)) }),
  v.check(
    (d) =>
      typeof (d as { parse?: unknown }).parse === 'function' ||
      typeof (d as { generate?: unknown }).generate === 'function',
    'driver has neither parse() nor generate()',
  ),
);

export const TakoConfigSchema = v.object({
  sources: v.pipe(
    v.record(
      v.pipe(v.string(), v.regex(NAMESPACE_RE)),
      v.object({
        use: DriverObject,
        options: v.optional(v.unknown()),
      }),
    ),
    v.minEntries(1),
  ),
  generators: v.array(
    v.object({
      use: DriverObject,
      options: v.optional(v.unknown()),
      namespaces: v.optional(v.array(v.pipe(v.string(), v.minLength(1)))),
    }),
  ),
  outputs: v.pipe(
    v.array(
      v.object({
        dir: v.optional(v.string()),
        mode: v.optional(v.picklist(['dir', 'package'])),
        packagesDir: v.optional(v.string()),
        scope: v.optional(v.string()),
        packageManager: v.optional(v.picklist(['bun', 'pnpm', 'yarn', 'npm'])),
        generators: v.optional(v.array(v.pipe(v.string(), v.minLength(1)))),
      }),
    ),
    v.minLength(1),
  ),
  hooks: v.optional(
    v.object({
      afterEmit: v.optional(
        v.pipe(
          v.unknown(),
          v.check(
            (f) => f === undefined || typeof f === 'function',
            'afterEmit is not a function',
          ),
        ),
      ),
    }),
  ),
});

/** Turn Valibot issues into dotted-path `{ path, message }` form. */
export function normalizeIssues(
  issues: readonly v.BaseIssue<unknown>[],
): ConfigIssue[] {
  return issues.map((issue) => ({
    path: v.getDotPath(issue) ?? '',
    message: issue.message,
  }));
}
