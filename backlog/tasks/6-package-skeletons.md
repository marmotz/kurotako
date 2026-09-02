# CI — Package skeletons (7 packages)

**Status**: to do **Type**: CI **Issue**: [#6](https://github.com/marmotz/kurotako/issues/6)

Reference: [../features/monorepo-bootstrap/technical.md §Target layout](../features/monorepo-bootstrap/technical.md#target-layout)
and [§Package
`package.json` (dual ESM + CJS)](../features/monorepo-bootstrap/technical.md#package-packagejson-dual-esm--cjs).

## To do

1. Create the 7 `packages/<short-name>` folders: `ir`, `core`, `config`, `cli`,
   `parser-prisma`, `gen-zod`, `gen-angular`. `name` = `@kurotako/<short-name>`.
   (`config` is required by the config-system feature; it references `../core` + `../ir`,
   and `cli` references `../config`.)
2. Per package:
    - `package.json`: version `0.0.0`, `type: module`, dual `exports`
      (`types`/`import`/`require`), `main`/`module`/`types`, `files: ["dist"]`,
      `engines.node >= 24`, scripts `build`/`typecheck`/`test`,
      `publishConfig.access = public`.
    - `tsconfig.json` extending `../../tsconfig.base.json` (`outDir: dist`, `rootDir: src`,
      `references` to the imported internal packages — exact list per package below,
      pinned by the downstream feature technical designs):

      | Package | `references` |
      |---|---|
      | `ir` | *(none)* |
      | `core` | `../ir` |
      | `config` | `../core`, `../ir` |
      | `cli` | `../config`, `../core` (imports `@kurotako/ir` only transitively) |
      | `parser-prisma` | `../ir`, `../core`, `../config` |
      | `gen-zod` | `../ir`, `../core`, `../config` |
      | `gen-angular` | `../ir`, `../core`, `../config`, `../gen-zod` |
    - `tsup.config.ts` re-exporting `basePreset`.
    - minimal `vitest.config.ts`.
    - `src/index.ts`: an `export const version` (read from `package.json` or a constant).
    - `src/index.test.ts`: a trivial passing test.
3. `cli` additionally: entry `src/bin/tako.ts` (shebang `#!/usr/bin/env node`),
   `"bin": { "tako": "./dist/bin/tako.js" }`, working `--version`.
4. Fill in the `references` of the root "solution" `tsconfig.json`.
5. `bun install`, then check `bun run typecheck`, `bun run test`, `bun run build` OK.
6. The skeleton must stay a valid template for what mode B will emit
   ([ADR-0005](https://github.com/marmotz/kurotako/blob/main/docs/adr/0005-output-modes.md)).
7. `packages/core/package.json` additionally lists `tsup` under `dependencies` (not just
   the root devDependency): [output-modes](../features/output-modes/technical.md) put the
   mode-B `packageWriter` (which runs a tsup build per generated package) inside
   `@kurotako/core`, loaded lazily. Still seven packages — no `@kurotako/output`.
8. Skeleton `package.json` files carry only the placeholder's own deps; real deps are
   added by each package's feature task. Those tasks follow the **peer dependency policy**
   ([../features/monorepo-bootstrap/technical.md §Peer dependency policy](../features/monorepo-bootstrap/technical.md#peer-dependency-policy)):
   an internal `@kurotako/*` package needed for a shared identity-carrying value (the
   `TakoError` base from `@kurotako/core`) is a `peerDependency` + `devDependency`
   everywhere except the leaf `@kurotako/cli`; `@kurotako/ir` / `valibot` / `jiti` stay
   plain `dependencies`.

## Dependencies

- [#2](2-shared-typescript-config.md)
- [#3](3-tsup-build-preset.md)
- [#4](4-vitest-workspace.md)
