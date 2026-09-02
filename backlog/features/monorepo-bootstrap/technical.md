# Monorepo bootstrap — technical design

Design for the initial repository skeleton. No code exists yet: every path below is to be
**created**. Product decisions come from
[overview.md](overview.md); this document turns them into concrete files.

## Starting point

- Repo tree today: `docs/` (vision, architecture, IR, ADRs), `backlog/`, `.serena/`.
  No `package.json`, no `src`, no tooling.
- Git: branch `develop`, no commits pushed yet. The GitHub repo `marmotz/kurotako` exists
  ([backlog/AGENTS.md](../../AGENTS.md)); CI runs once the first commit lands on the
  default branch.
- Relevant ADRs: [ADR-0001](../../../docs/adr/0001-name-kurotako.md) (scope `@kurotako/*`,
  binary `tako`), [ADR-0005](../../../docs/adr/0005-output-modes.md) (mode B emits real
  packages — the bootstrap package skeleton must be a valid template for what `gen-*`
  later emits).

## Target layout

```
kurotako/
  package.json                 # private root, workspaces, aggregate scripts
  bunfig.toml                  # bun config (optional, see below)
  tsconfig.json                # solution file: references every package
  tsconfig.base.json           # shared compiler options
  tsup.config.base.ts          # shared build preset, re-exported per package
  vitest.workspace.ts          # discovers packages/*/vitest.config.ts
  biome.json                   # lint + format
  lefthook.yml                 # git hooks
  .changeset/config.json       # release config
  .github/workflows/ci.yml     # install → typecheck → lint → test → build
  .editorconfig
  .gitignore
  .node-version                # 24
  LICENSE                      # MIT
  README.md
  CONTRIBUTING.md
  CODE_OF_CONDUCT.md
  packages/
    ir/
      package.json
      tsconfig.json
      tsup.config.ts
      vitest.config.ts
      src/index.ts
      src/index.test.ts
    core/
    config/
    cli/
    parser-prisma/
    gen-zod/
    gen-angular/
  apps/
    docs/                        # Docusaurus site, private, added by task #54
```

`packages/<short-name>` with `package.json` `name` = `@kurotako/<short-name>`
(decided in overview). `cli` additionally exposes the `tako` bin.

`apps/docs` (`@kurotako/docs`, private, never published, outside `tsc -b`) is the
documentation site — [docs-site/technical.md](../docs-site/technical.md). The scaffold
tasks below are written for `packages/*` only; task
[#54 apps-docs-workspace-accommodation](../../tasks/54-apps-docs-workspace-accommodation.md)
folds the `apps/*` workspace into the root files once the site lands.

The seven packages are scaffolded empty (a single exported `version` const + one trivial
passing test) so the whole toolchain is exercised end to end from day one. Their real
content is the subject of the downstream features. `config` (`@kurotako/config`) is
required by [config-system](../config-system/technical.md); it references `../core` and
`../ir`, and `cli` references `../config`.

## Package manager — Bun workspaces

- Root `package.json`:
  - `"private": true`
  - `"workspaces": ["packages/*"]` — task [#54](../../tasks/54-apps-docs-workspace-accommodation.md)
    later adds `"apps/*"` for the docs site
  - `"packageManager": "bun@<pinned>"` (Corepack-style pin; also documented in README)
  - `"engines": { "node": ">=24", "bun": ">=<pinned>" }`
- Lockfile: `bun.lock` (text format), committed.
- Internal deps use the workspace protocol: `"@kurotako/ir": "workspace:*"`.
- `bunfig.toml`: only if we need to force `linker = "isolated"` or registry settings;
  start without it and add if a real need appears.

Bun is the installer and script runner **only**. No `Bun.*` API in any published
package: shared code must run unmodified on Node 24+ and on Bun. The `tako` bin uses a
plain `#!/usr/bin/env node` shebang and standard Node APIs; it is additionally smoke-run
under Bun in CI (see below).

### Alternative considered

pnpm workspaces (the usual monorepo default). Rejected because the user explicitly chose
Bun; pnpm remains the fallback if Bun's CI/publish story proves too rough. The abstraction
cost is low — scripts are plain `package.json` scripts, not Bun-specific.

## TypeScript

### `tsconfig.base.json`

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "verbatimModuleSyntax": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "composite": true,
    "incremental": true,
    "isolatedModules": true,
    "skipLibCheck": true
  }
}
```

- `target ES2022` / `lib ES2023`: conservative emit, decided in overview.
- Minimum consumer-side TypeScript: **5.5** (settled with the user). `package.json` of
  each package declares `"typesVersions"` only if needed; the README states the 5.5 floor.
- `composite: true` + project references → `tsc -b` gives incremental, correctly ordered
  typecheck across packages.

### Per-package `tsconfig.json`

```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"],
  "references": [{ "path": "../ir" }]   // core, cli, gen-* reference what they import
}
```

### Root solution `tsconfig.json`

`{ "files": [], "references": [ every package ] }` — the target of `tsc -b` at the root.

Typecheck is **not** delegated to tsup (tsup/esbuild does not type-check). The repo Stop
hook that runs `typecheck` maps to `bun run typecheck` = `tsc -b`.

## Build — tsup

Shared preset `tsup.config.base.ts`:

```ts
import { defineConfig, type Options } from 'tsup'

export const basePreset: Options = {
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],   // dual output, decided in overview
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'node24',
  outDir: 'dist',
}
```

Per-package `tsup.config.ts` re-exports it, overriding `entry` where a package has more
than one entry point (e.g. `cli` adds `src/bin/tako.ts`).

### Package `package.json` (dual ESM + CJS)

```jsonc
{
  "name": "@kurotako/ir",
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
  "files": ["dist"],
  "engines": { "node": ">=24" },
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc -b",
    "test": "vitest run"
  },
  "publishConfig": { "access": "public" }
}
```

`cli` adds `"bin": { "tako": "./dist/bin/tako.js" }` and keeps only the ESM build for the
bin (the library entry can stay dual for programmatic use).

### Peer dependency policy

An internal `@kurotako/*` package that another `@kurotako/*` package depends on for a
**shared value that carries identity** — today only the `TakoError` base class exported by
`@kurotako/core` — is declared as a **`peerDependency` + `devDependency`**, never a plain
`dependency`, in every package except the leaf executable `@kurotako/cli`.

Rationale: `@kurotako/config` and the drivers all re-export / extend `TakoError`, and the
CLI catches every domain error with a single `instanceof TakoError`. If npm/bun resolved
two different `@kurotako/core` copies into one install (possible once packages carry real
semver, post-MVP), that `instanceof` would silently fail and a clean config error would
surface as an "internal error" stack trace. A peer edge forces a single shared `core`; the
leaf `@kurotako/cli` (which nothing else depends on) pins the concrete version in its
`dependencies`.

Packages with **no shared identity** stay plain `dependencies`: `@kurotako/ir` (pure data
+ pure functions — a duplicate copy is wasteful but correct), `valibot`, `jiti`, `citty`,
`chokidar`, `tsup`.

Concretely:

| Package | peer + dev | plain deps |
|---|---|---|
| `ir` | — | `valibot` |
| `core` | — | `@kurotako/ir`, `tsup` (lazy, mode B) |
| `config` | `@kurotako/core` | `@kurotako/ir`, `valibot`, `jiti` |
| `cli` | — | `@kurotako/config`, `@kurotako/core`, `citty`, `chokidar` |
| `parser-prisma` | `@kurotako/core`, `@kurotako/config`, `@prisma/internals` | `@kurotako/ir`, `valibot` |
| `gen-zod` | `@kurotako/core`, `@kurotako/config` | `@kurotako/ir`, `valibot` |
| `gen-angular` | `@kurotako/core`, `@kurotako/config`, `@kurotako/gen-zod` | `@kurotako/ir`, `valibot` |

(The driver rows already match their feature technical designs; the `config` row is the
one this policy changes — it was a plain `dependency` on `@kurotako/core` in an earlier
draft.)

### `dist/` — not committed

Settled with the user. `dist/` is in `.gitignore`. Consequences:

- `prepublishOnly` (or the changesets publish step) runs `build` before packing.
- CI builds explicitly.
- Anyone cloning the repo runs `bun install && bun run build` once before using a package
  from source; documented in CONTRIBUTING.
- No source/dist drift, no noisy diffs.

### Alternative considered

`tsdown` (rolldown-based, positioned as the tsup successor) and `tsc` project references
alone. Kept `tsup` per the overview decision; `tsdown` is a drop-in migration path later
if tsup stalls. `tsc`-only was rejected: no bundling, no clean dual CJS/ESM emit.

## Tests — vitest

- `vitest.workspace.ts` at the root globs `packages/*/vitest.config.ts`.
- `bun run test` at the root → `vitest run` across the workspace; per package →
  `vitest run` scoped.
- Snapshot testing (vitest built-in) is reserved for the generated-code features
  ([docs/vision.md §10](../../../docs/vision.md#open-questions)); the bootstrap only ships
  one trivial test per package.
- Coverage via `@vitest/coverage-v8`, not gated in v1.

## Lint + format — Biome

- `biome.json`: `"linter": { "rules": { "recommended": true } }`, formatter enabled
  (spaces, single quotes, trailing commas — mirror `.editorconfig`).
- `bun run lint` → `biome check .`; `bun run format` → `biome format --write .`.
- Rule set: **recommended only** for now (settled with the user); hardening is a later,
  separate change once there is real code to measure friction against.

## Git hooks — lefthook

`lefthook.yml`:

```yaml
pre-commit:
  parallel: true
  commands:
    biome:
      glob: "*.{ts,tsx,js,json,jsonc}"
      run: bunx biome check --no-errors-on-unmatched --staged {staged_files}
    typecheck:
      run: bun run typecheck
```

- Installed via a root `"prepare": "lefthook install"` script.
- `typecheck` on pre-commit is `tsc -b` (incremental, so cheap after the first run); drop
  it to pre-push if it proves too slow on large working sets.

## Versioning / publishing — changesets

`.changeset/config.json`:

```jsonc
{
  "$schema": "https://unpkg.com/@changesets/config/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "linked": [],
  "fixed": []
}
```

**Independent versioning** (`linked: []`, `fixed: []`) — recommendation, decided here.

Rationale:
- The architecture is explicitly "one central body, semi-autonomous arms"
  ([ADR-0001](../../../docs/adr/0001-name-kurotako.md)). A parser and a generator evolve on
  unrelated schedules; a `parser-prisma` patch has no reason to bump `gen-angular`.
- Independent is the changesets default and the low-friction path: you only write a
  changeset for what you touched, only those packages are released.
- Angular-style fixed versioning buys a single number to communicate, but forces a release
  of every package on every change and implies a lockstep peer-dependency contract we do
  not have.
- `updateInternalDependencies: "patch"` keeps the internal `workspace:*` graph coherent:
  when `ir` gets a minor bump, its dependents get a patch bump automatically.

All packages start at `0.0.0` and are `0.x` until the MVP (`parser-prisma` + `gen-zod` +
`gen-angular` + `cli`) works end to end, so breaking changes stay cheap during bring-up.

Publishing is manual-trigger only until the repo exists: the release workflow
(`changeset version` → PR, then `changeset publish` on merge) is written alongside `ci.yml`
but left disabled.

### Alternative considered

`fixed` on all `@kurotako/*`. Rejected for the reasons above. Revisitable if we ever ship
the packages as a single documented "distribution".

## CI — GitHub Actions

`.github/workflows/ci.yml`, triggers `push` + `pull_request`:

```yaml
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with: { bun-version-file: package.json }   # reads packageManager
      - uses: actions/setup-node@v4
        with: { node-version: '24' }
      - run: bun install --frozen-lockfile
      - run: bun run typecheck
      - run: bun run lint
      - run: bun run test
      - run: bun run build
      - run: node packages/cli/dist/bin/tako.js --version   # Node smoke
      - run: bun packages/cli/dist/bin/tako.js --version     # Bun smoke
```

- Single job, sequential — fast enough at this size; split later if needed.
- A matrix on Node (`24`, `latest`) is added once there is real runtime code; the
  bootstrap keeps it to Node 24 to keep the file honest.
- The workflow file lives in the repo from the first commit but only executes once the
  GitHub remote exists ([backlog/AGENTS.md](../../AGENTS.md)).

## Root aggregate scripts

```jsonc
{
  "scripts": {
    "build": "tsup --config ... || bun run --filter '*' build",
    "typecheck": "tsc -b",
    "test": "vitest run",
    "lint": "biome check .",
    "format": "biome format --write .",
    "prepare": "lefthook install",
    "release": "changeset publish"
  }
}
```

`bun run --filter '*' <script>` fans a script across every workspace package. The root
`typecheck`/`test`/`lint` use the workspace-aware tools directly (one process, faster than
fan-out).

## Meta files

- **LICENSE**: MIT, copyright holder = the project author, year 2026.
- **README.md**: one-paragraph pitch (from [docs/vision.md](../../../docs/vision.md)),
  install, `bun install && bun run build`, link to `docs/`.
- **CONTRIBUTING.md**: toolchain versions (Node 24, Bun pin), `bun install`, the aggregate
  scripts, "run a changeset for every user-facing change", hook behaviour.
- **CODE_OF_CONDUCT.md**: Contributor Covenant 2.1, verbatim.
- **.editorconfig**: UTF-8, LF, final newline, 2-space indent — kept consistent with
  `biome.json`.
- **.gitignore**: `node_modules`, `dist`, `*.tsbuildinfo`, `coverage`, `.DS_Store`.
- **.node-version**: `24` (picked up by `setup-node` and by fnm/nvm locally).

## Consequences verified against the current repo

- Nothing to migrate: the repo has no code. The only existing directories (`docs/`,
  `backlog/`, `.serena/`) are untouched; `.gitignore` must not exclude them.
- `.serena/` already has its own `.gitignore`; the root `.gitignore` leaves it alone.
- The `develop` branch has no commits; `changeset` `baseBranch` is set to `main`, so the
  first push should establish `main` (or the config is flipped to `develop` — a one-line
  change to make when the repo is created and the default branch is chosen).
- The per-package `package.json` skeleton here is deliberately shaped like what mode B
  (`gen-*` emitting real packages, [ADR-0005](../../../docs/adr/0005-output-modes.md)) will
  need to produce, so `output-modes` can reuse it as the template.
- **[output-modes/technical.md](../output-modes/technical.md)** decided the mode-B
  plumbing lives in `@kurotako/core`, so `packages/core/package.json` promotes `tsup` from
  a root devDependency to its own `dependencies` (loaded lazily, mode-B path only). No new
  package skeleton — the "dedicated `@kurotako/output` package" alternative was rejected;
  the seven packages stay as listed. Task [#6](../../tasks/6-package-skeletons.md).
- **[docs-site/technical.md](../docs-site/technical.md)** adds an `apps/docs` workspace
  (Docusaurus, private, not published, outside `tsc -b`). The root-file amendments it
  forces are collected in task
  [#54 apps-docs-workspace-accommodation](../../tasks/54-apps-docs-workspace-accommodation.md):
  `workspaces` gains `"apps/*"`; `.gitignore` gains `apps/docs/build`,
  `apps/docs/.docusaurus`, `apps/docs/docs/api`; `biome.json` excludes those plus
  `apps/docs/versioned_docs`; `.changeset/config.json` `ignore` lists `@kurotako/docs`;
  `CONTRIBUTING.md` documents the `docusaurus docs:version` release step and the docs dev
  loop. `ci.yml` is untouched — the site ships its own `.github/workflows/docs.yml`
  (a docs-site deliverable, not part of this feature).

## Still open (small, non-blocking)

- Exact pinned versions of Bun, Biome, tsup, vitest, lefthook, changesets — resolve to
  latest stable at implementation time.
- Whether `typecheck` stays on `pre-commit` or moves to `pre-push` (decide after feeling
  the latency on a populated repo).
- Copyright holder string in `LICENSE` (personal name vs an org) — depends on who owns the
  future GitHub repo.

## Breakdown into implementation tasks

Task files under [`../../tasks/`](../../tasks/), GitHub issues on `marmotz/kurotako`.

1. [#1 root-workspace-scaffold](../../tasks/1-root-workspace-scaffold.md) — root
   `package.json`, Bun workspaces, `.gitignore`, `.node-version`, `.editorconfig`.
2. [#2 shared-typescript-config](../../tasks/2-shared-typescript-config.md) —
   `tsconfig.base.json` + solution `tsconfig.json`, `typecheck` script (dep: #1).
3. [#3 tsup-build-preset](../../tasks/3-tsup-build-preset.md) — `tsup.config.base.ts`,
   `build` script (dep: #1).
4. [#4 vitest-workspace](../../tasks/4-vitest-workspace.md) — `vitest.workspace.ts`,
   coverage, `test` script (dep: #1).
5. [#5 biome-lint-format](../../tasks/5-biome-lint-format.md) — `biome.json`,
   `lint`/`format` scripts (dep: #1).
6. [#6 package-skeletons](../../tasks/6-package-skeletons.md) — the 7 `packages/*`
   skeletons (deps: #2, #3, #4).
7. [#7 lefthook-git-hooks](../../tasks/7-lefthook-git-hooks.md) — `lefthook.yml`,
   `prepare` script (deps: #2, #5).
8. [#8 changesets-release](../../tasks/8-changesets-release.md) —
   `.changeset/config.json`, independent versioning (dep: #6).
9. [#9 ci-workflow](../../tasks/9-ci-workflow.md) — `.github/workflows/ci.yml`
   (deps: #6, #8).
10. [#10 repo-meta-files](../../tasks/10-repo-meta-files.md) — `LICENSE`, `README`,
    `CONTRIBUTING`, `CODE_OF_CONDUCT` (dep: #1).
11. [#54 apps-docs-workspace-accommodation](../../tasks/54-apps-docs-workspace-accommodation.md)
    — fold the `apps/*` workspace for the docs site into the root files: `workspaces`,
    `.gitignore`, `biome.json`, `.changeset/config.json` `ignore`, `CONTRIBUTING.md`
    (deps: #1, #5, #8, #10). Added for [docs-site](../docs-site/technical.md); does not
    block the MVP.
