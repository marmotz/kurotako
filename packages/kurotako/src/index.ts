/**
 * `kurotako` — the umbrella package. Install this one name to get the `tako`
 * binary and the `defineConfig` helper your `tako.config.ts` imports.
 *
 * Re-exports the config authoring surface of `@kurotako/config`. The CLI's
 * programmatic API (`runCli`, reporters) stays in `@kurotako/cli`; loader
 * internals (`loadConfig`, `TakoConfigSchema`, error classes, `CONFIG_TEMPLATE`)
 * stay in `@kurotako/config` for consumers that depend on it directly.
 *
 * See `backlog/features/meta-package/technical.md`.
 */

export type * from '@kurotako/config';
export { defineConfig, defineGenerator, defineParser } from '@kurotako/config';
