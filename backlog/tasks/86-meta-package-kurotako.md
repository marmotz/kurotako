# backend — `kurotako` meta-package (single install, re-exports `defineConfig`)

**Status**: done
**Type**: backend
**Issue**: [#86](https://github.com/marmotz/kurotako/issues/86)

Reference: [../features/meta-package/technical.md](../features/meta-package/technical.md),
[../features/meta-package/overview.md](../features/meta-package/overview.md).

## Why

Using `tako` needs two installs today — `@kurotako/cli` (binary) and `@kurotako/config`
(`defineConfig`, imported by every `tako.config.ts`). This adds a single umbrella package
`kurotako`: one install, `import { defineConfig } from 'kurotako'`. The parts stay
published for advanced use.

## Verified

- `@kurotako/cli`: `src/index.ts` exports `runCli`; `src/bin/tako.ts` is
  `#!/usr/bin/env node` + `await runCli(process.argv.slice(2))`; `tsup.config.ts` exports
  an array (dual lib entry + ESM-only `bin/tako` entry) with
  `define: { __TAKO_VERSION__: <pkg.version> }`; `package.json`
  `bin: { "tako": "./dist/bin/tako.js" }`.
- `@kurotako/config`: `src/index.ts` already exports `defineConfig`, `defineParser`,
  `defineGenerator` and `export type * from './types.js'`; `@kurotako/core` is a
  `peerDependency`.
- Neither package needs a code change.

## To do

1. `packages/kurotako/package.json` — name `kurotako` (unscoped), `version` `0.0.0`,
   `"type": "module"`, `exports.` dual (`types`/`import`/`require`), `main`/`module`/
   `types`, `"sideEffects": false`, `"files": ["dist"]`, `engines.node >= 24`,
   `bin: { "tako": "./dist/bin/tako.js" }`, `publishConfig.access: "public"`,
   `dependencies`: `@kurotako/cli` `workspace:*` + `@kurotako/config` `workspace:*`.
   Scripts `build` (`tsup`), `typecheck` (`tsc -b`), `test` (`vitest run`). **Do not** add
   it to `.changeset/config.json` `ignore`.
2. `packages/kurotako/src/index.ts` —
   ```ts
   export { defineConfig, defineGenerator, defineParser } from '@kurotako/config';
   export type * from '@kurotako/config';
   ```
   Nothing else (no `loadConfig` / `TakoConfigSchema` / errors / `CONFIG_TEMPLATE`).
3. `packages/kurotako/src/bin/tako.ts` — `#!/usr/bin/env node`; `declare const
   __TAKO_VERSION__: string`; if `argv[0]` is `--version` / `-v` print
   `__TAKO_VERSION__` and set `process.exitCode = 0`, else `await runCli(argv)`
   (`import { runCli } from '@kurotako/cli'`). ESM-only entry.
4. `packages/kurotako/tsup.config.ts` — copy `packages/cli/tsup.config.ts`: read this
   `package.json` version, `define = { __TAKO_VERSION__: JSON.stringify(pkg.version) }`,
   export `[ { ...basePreset, entry: ['src/index.ts'], define }, { ...basePreset, entry: {
   'bin/tako': 'src/bin/tako.ts' }, format: ['esm'], clean: false, define } ]`.
5. `packages/kurotako/tsconfig.json` — `extends ../../tsconfig.base.json`,
   `outDir: dist`, `rootDir: src`, `include: ["src"]`,
   `references: [{ "path": "../cli" }, { "path": "../config" }]`. Add
   `{ "path": "packages/kurotako" }` to the root solution `tsconfig.json` `references`.
6. `packages/kurotako/vitest.config.ts` — minimal, matching the other packages so
   `vitest.workspace.ts` / the root `test` picks it up.
7. `.github/workflows/ci.yml` — add `packages/kurotako/dist/bin/tako.js` to the existing
   `node …/tako.js --version` / `bun …/tako.js --version` smoke steps; assert it prints
   the `kurotako` version.
8. Tests (colocated vitest):
   - `src/index.test.ts` — `defineConfig(x) === x` (identity, re-exported); `defineParser`
     / `defineGenerator` are functions.
   - `src/bin.test.ts` — spawn the built `dist/bin/tako.js` (build in a `beforeAll` or
     rely on `bun run build`): `--version` prints this package's `package.json` version
     (pin a fixture version so the assertion distinguishes it from `@kurotako/cli`'s);
     `--help` → exit 0, usage lists `init` / `generate` / `validate`; `generate` in an
     empty temp dir → exit 1 (`ConfigNotFoundError` path, same as `@kurotako/cli`).
9. `bunx changeset` — `minor` for `kurotako` (new package / new public API).
10. Docs:
    - [../features/config-system/technical.md](../_archives/features/config-system/technical.md) —
      annotate the `import { defineConfig } from '@kurotako/config'` mention: the
      documented path is `from 'kurotako'`; `@kurotako/config` is the direct-dependency
      escape hatch.
    - `apps/docs/docs/getting-started/quick-start.md` + `installation.md` — step 1 becomes
      `npm install -D kurotako` (with the `bun add -d` / pnpm / Yarn forms) and
      `import { defineConfig } from 'kurotako'`. Leave the parser/generator install steps
      and every `reference/*` page unchanged.
    - [../../docs/architecture.md](../../docs/architecture.md) /
      [../../docs/vision.md](../../docs/vision.md) "Decisions already made" — record the
      `kurotako` meta-package (one install, re-exports `defineConfig`, binary stays
      `tako`). May ride [#60](60-docs-reconciliation-post-mvp.md).
11. `bun run typecheck`, `bun run test`, `bun run build`, `bun run lint` green.

## Dependencies

- [44-cli-scaffold-reporter-errors](44-cli-scaffold-reporter-errors.md) — `runCli` + bin (done).
- [25-config-load](25-config-load.md) — `@kurotako/config` public surface (done).
