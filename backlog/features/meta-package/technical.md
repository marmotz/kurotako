# `kurotako` meta-package — technical design

Design for the `kurotako` umbrella package. Product decisions come from
[overview.md](overview.md). This turns them into a concrete package that re-exposes the
`tako` binary and `defineConfig` so a project installs **one** name.

## Starting point

- `@kurotako/cli` ([cli/technical.md](../cli/technical.md)) is implemented: `package.json`
  `bin: { "tako": "./dist/bin/tako.js" }`, `src/bin/tako.ts` is a thin
  `#!/usr/bin/env node` + top-level `await runCli(process.argv.slice(2))`, `src/index.ts`
  exports `runCli` and the reporter/error helpers. `tsup.config.ts` builds an array:
  dual ESM+CJS library entry + **ESM-only** `bin/tako` entry, both with
  `define: { __TAKO_VERSION__: <pkg.version> }`.
- `@kurotako/config` ([config-system/technical.md](../config-system/technical.md)) is
  implemented: `src/index.ts` exports `defineConfig`, `defineParser`, `defineGenerator`,
  the error classes, `loadConfig`, `resolveConfigFile`, `TakoConfigSchema`,
  `CONFIG_TEMPLATE` and `export type * from './types.js'`. It has `@kurotako/core` as a
  **peerDependency**; `@kurotako/cli` provides the concrete `core`.
- Toolchain (from [monorepo-bootstrap/technical.md](../monorepo-bootstrap/technical.md)):
  Bun workspaces, `tsc -b` project references, tsup dual build, vitest, Biome,
  changesets (independent versioning), CI bin smoke-test under Node **and** Bun. Node >= 24,
  **no `Bun.*` API**.

## Package — `packages/kurotako`

```
packages/kurotako/
  package.json          # name "kurotako" (unscoped), bin tako, deps on cli + config
  tsup.config.ts        # array: dual lib entry + ESM-only bin entry (mirrors cli)
  tsconfig.json         # references ../cli and ../config
  vitest.config.ts
  src/
    index.ts            # re-export the config authoring surface from @kurotako/config
    bin/tako.ts         # #!/usr/bin/env node; own --version, else delegate to runCli
    index.test.ts
    bin.test.ts
```

### `package.json`

```jsonc
{
  "name": "kurotako",
  "version": "0.0.0",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "sideEffects": false,
  "files": ["dist"],
  "engines": { "node": ">=24" },
  "bin": { "tako": "./dist/bin/tako.js" },
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc -b",
    "test": "vitest run"
  },
  "publishConfig": { "access": "public" },
  "dependencies": {
    "@kurotako/cli": "workspace:*",
    "@kurotako/config": "workspace:*"
  }
}
```

- **`dependencies`, not `peerDependencies`.** The whole point is that installing
  `kurotako` installs both. `@kurotako/config`'s `@kurotako/core` peer is satisfied by
  `@kurotako/cli`'s direct `core` dependency, resolved in the same tree.
- On publish, changesets rewrites `workspace:*` to a caret range against the current
  version of each part (changesets default). `kurotako@x` then pulls
  `@kurotako/cli@^x'` / `@kurotako/config@^x''` — the parts keep versioning
  independently.
- **Not** added to `.changeset/config.json` `ignore` — it is published.

### `src/index.ts`

```ts
/**
 * `kurotako` — the umbrella package. Install this one name to get the `tako`
 * binary and the `defineConfig` helper your `tako.config.ts` imports.
 *
 * Re-exports the config authoring surface of `@kurotako/config`. The CLI's
 * programmatic API (`runCli`, reporters) stays in `@kurotako/cli`.
 */
export {
  defineConfig,
  defineGenerator,
  defineParser,
} from '@kurotako/config';
export type * from '@kurotako/config';
```

`export type *` carries `TakoConfig`, `TakoParser`, `TakoGenerator`, `OutputOption`,
`TakoHooks`, the `OptionsOf` helper etc. — everything a typed config file needs. Runtime
values beyond the three `define*` helpers (`loadConfig`, `TakoConfigSchema`, the error
classes, `CONFIG_TEMPLATE`) are **not** re-exported: they are loader/CLI internals, and a
consumer that genuinely needs them can depend on `@kurotako/config` directly.

### `src/bin/tako.ts`

```ts
#!/usr/bin/env node
/**
 * `kurotako`'s `tako` entry. Handles `--version` / `-v` itself (so it reports
 * the version the user installed, not `@kurotako/cli`'s), then delegates
 * everything else to the CLI.
 */
import { runCli } from '@kurotako/cli';

declare const __TAKO_VERSION__: string;

const argv = process.argv.slice(2);
if (argv[0] === '--version' || argv[0] === '-v') {
  process.stdout.write(`${__TAKO_VERSION__}\n`);
  process.exitCode = 0;
} else {
  await runCli(argv);
}
```

- ESM-only entry (top-level `await`), exactly like `@kurotako/cli`'s bin.
- `__TAKO_VERSION__` is injected by this package's `tsup` `define` from **this** package's
  `package.json` (resolves overview open question #1: the number the user installed).
- Delegating to `runCli` means `tako --help`, `init`, `generate`, `validate`, `check` and
  the exit-code contract are unchanged — **no `@kurotako/cli` code change**.

### `tsup.config.ts`

Copy `packages/cli/tsup.config.ts`: read `./package.json` for the version, build
`define`, export the array `[ { lib entry, dual, define }, { 'bin/tako' entry, esm only,
clean: false, define } ]`.

### `tsconfig.json`

```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"],
  "references": [{ "path": "../cli" }, { "path": "../config" }]
}
```

Add `{ "path": "packages/kurotako" }` to the root solution `tsconfig.json` references.

## Tests (`vitest`, colocated)

- `index.test.ts` — `defineConfig` is re-exported and is identity
  (`defineConfig(x) === x`); `defineParser` / `defineGenerator` re-exported.
- `bin.test.ts` — run the built `dist/bin/tako.js` as a child process:
  - `tako --version` → prints `kurotako`'s `package.json` version (not `@kurotako/cli`'s
    when they differ — pin a fixture version to assert the distinction);
  - `tako --help` → exit 0, usage text mentions `init` / `generate` / `validate`;
  - `tako generate` in an empty dir → the same `ConfigNotFoundError` path as
    `@kurotako/cli` (exit 1).

## Amendments to other features

- **[monorepo-bootstrap #6 package-skeletons](../../tasks/6-package-skeletons.md)** —
  add `packages/kurotako` to the skeleton set (seventh published package, eighth overall
  after `apps/docs`). Root `tsconfig.json` gains its reference.
- **[monorepo-bootstrap #9 CI](../../tasks/9-ci-workflow.md)** — the bin smoke-test
  matrix (`node …/tako.js --version` / `bun …/tako.js --version`) runs against
  `packages/kurotako/dist/bin/tako.js` too, asserting the `kurotako` version.
- **[config-system/technical.md](../config-system/technical.md)** — the sentence
  "the user's `tako.config.ts` does `import { defineConfig } from '@kurotako/config'`"
  gains a note: the documented path is `import { defineConfig } from 'kurotako'`;
  `@kurotako/config` stays the direct-dependency escape hatch.
- **[docs/architecture.md](../../../docs/architecture.md)** /
  [docs/vision.md](../../../docs/vision.md) "Decisions already made" — record the
  `kurotako` meta-package (one install, re-exports `defineConfig`, binary stays `tako`).
  Doc-only; can ride [task #60](../../tasks/60-docs-reconciliation-post-mvp.md).
- **[docs-site content](../docs-site/technical.md)** — `apps/docs`
  `getting-started/quick-start.md` and `installation.md` switch step 1 to
  `npm install -D kurotako` (+ Bun/pnpm/Yarn forms) and
  `import { defineConfig } from 'kurotako'`. The parser/generator install steps are
  unchanged. `reference/*` unaffected.

## Consequences verified against the current repo

- `@kurotako/cli` needs **no change**: `runCli` is already exported, the bin already
  delegates to it, and the meta bin handles `--version` before delegating.
- `@kurotako/config` needs **no change for the meta-package itself**: its barrel already
  exports the three `define*` helpers and `export type * from './types.js'`. (Separately
  decided as a follow-up: `CONFIG_TEMPLATE` — what `tako init` writes — switches its
  import line to `from 'kurotako'`; see the follow-up task below and
  [overview.md](overview.md) "Decisions made".)
- No cycle: `kurotako → @kurotako/cli → @kurotako/config → @kurotako/core → @kurotako/ir`,
  and `kurotako → @kurotako/config` directly (already on that chain).
- `bun install` resolves one extra small package; negligible.

## Découpage en tâches d'implémentation

One task is enough — the package is thin and touches no existing package source.

1. **`packages/kurotako` skeleton + bin + re-export + tests**
   ([86-meta-package-kurotako](../../tasks/86-meta-package-kurotako.md), done) — the
   package above, the root `tsconfig.json` reference, the CI smoke-test matrix entry, a
   changeset, and the doc edits (`config-system/technical.md` note, `apps/docs`
   getting-started switch).
2. **`tako init` writes `from 'kurotako'`**
   ([94-tako-init-kurotako-import-surface](../../tasks/94-tako-init-kurotako-import-surface.md))
   — `CONFIG_TEMPLATE` / `CONFIG_TEMPLATE_MONOREPO` import line + `reference/*` docs.
   Follow-up from the post-merge review; depends on
   [#90](https://github.com/marmotz/kurotako/issues/90).
