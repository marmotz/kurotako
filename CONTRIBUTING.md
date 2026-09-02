# Contributing to kurotako

## Toolchain

| Tool | Version | Role |
|---|---|---|
| Node.js | >= 24 | Runtime (`.node-version` = `24`) |
| Bun | >= 1.4 (`packageManager` pin) | Installer + script runner only |
| TypeScript | 7.x in-repo, 5.5 consumer floor | `tsc -b` typecheck |
| tsup | 8.x | Build (dual ESM + CJS) |
| vitest | 4.x | Tests |
| Biome | 2.x | Lint + format |
| lefthook | 2.x | Git hooks |
| changesets | 3.x | Independent versioning + publish |

Published packages must run unmodified on Node 24+ and on Bun — no `Bun.*` APIs in
`packages/*`.

## Setup

```bash
bun install          # installs deps and runs `lefthook install` via `prepare`
bun run build        # dist/ is gitignored; build once before using a package from source
```

## Aggregate scripts

Run from the repo root:

- `bun run build` — `bun run --filter '*' build`
- `bun run typecheck` — `tsc -b`
- `bun run test` — `vitest run`
- `bun run lint` — `biome check .`
- `bun run format` — `biome format --write .`

## Changesets

Run a changeset for **every user-facing change**:

```bash
bunx changeset
```

Versioning is independent per package. Packages stay at `0.0.0` / `0.x` until the MVP
works end to end; the release workflow is disabled until then.

## Git hooks

`lefthook` runs on `pre-commit` (parallel):

- **biome** — `biome check` on staged `*.{ts,tsx,js,json,jsonc}` files
- **typecheck** — `tsc -b` (incremental, cheap after the first run)

## Documentation site (`apps/docs`)

The Docusaurus site lives in `apps/docs` (`@kurotako/docs`, private, never published,
outside `tsc -b`).

- Local dev loop:

  ```bash
  bun run --filter '@kurotako/docs' start
  ```

- On a `@kurotako/cli` release, cut a frozen docs version:

  ```bash
  bun run --filter '@kurotako/docs' docusaurus docs:version <major.minor>
  ```

  Commit the resulting `versioned_docs/`, `versioned_sidebars/` and `versions.json`.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
