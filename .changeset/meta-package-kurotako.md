---
"kurotako": minor
---

Add the `kurotako` umbrella package: a single install that provides the `tako`
binary and re-exports `defineConfig` / `defineParser` / `defineGenerator` (plus the
config type surface) from `@kurotako/config`.

A project can now `npm install -D kurotako` and write
`import { defineConfig } from 'kurotako'` in `tako.config.ts`, instead of installing
and importing `@kurotako/cli` + `@kurotako/config` separately. Both scoped packages
stay published for advanced/programmatic use (`runCli`, reporters, `loadConfig`,
`TakoConfigSchema`, error classes, `CONFIG_TEMPLATE`).

The meta `tako` bin handles `--version` / `-v` itself so it reports the version of
`kurotako` the user installed, and delegates every other command to
`@kurotako/cli`'s `runCli` unchanged.
