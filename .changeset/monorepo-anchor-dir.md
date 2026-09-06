---
"@kurotako/core": minor
"@kurotako/config": minor
"@kurotako/parser-prisma": minor
"@kurotako/cli": minor
---

Per-source anchor directory so a parser resolves its own schema-toolchain dependency
(`@prisma/internals`) from where the source's schema lives, plus a monorepo-aware
`tako init`.

`@kurotako/core`: `ParseContext` gains an optional `anchorDir` (absolute; the directory
the source is anchored at). `Parser` gains an optional already-curried `anchor(rootDir)`
hook; `run()` calls it before `parse()` and passes the result as `ParseContext.anchorDir`,
falling back to `config.rootDir` when the hook is absent or returns `undefined`.

`@kurotako/config`: `TakoParser` and `defineParser` accept an `anchor(rootDir, options)`
member; `loadConfig` curries the validated options away, exposing a plain
`Parser.anchor(rootDir)` to core. New `CONFIG_TEMPLATE_MONOREPO` export.

`@kurotako/parser-prisma`: `prismaParser` declares `anchor`, returning the directory of
`options.schema`. `@prisma/internals` is now resolved from that directory (walking up
`node_modules`), so it can be installed in the sub-project holding the schema rather than
only at the repo root. `PrismaPeerMissingError` mentions this.

`@kurotako/cli`: `tako init` gains `--monorepo` / `--no-monorepo`; when unset it
auto-detects a workspace (`workspaces` in the nearest `package.json`, or a sibling
`pnpm-workspace.yaml`) and writes `CONFIG_TEMPLATE_MONOREPO` accordingly.
