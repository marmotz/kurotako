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

- `bun run build` — `bun run --filter './packages/*' build` (the publishable packages;
  the docs site is built separately and never gates package CI)
- `bun run build:docs` — build the packages, then the `apps/docs` Docusaurus site
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

### API reference (TypeDoc)

`bun run --filter '@kurotako/docs' build` runs `docusaurus-plugin-typedoc` over the four
public packages (`@kurotako/ir`, `core`, `config`, `cli`) and writes the generated pages
to `apps/docs/docs/api/` (git-ignored on `develop`, frozen into `versioned_docs/` when a
version is cut). TypeDoc resolves each package's public types from its built
`dist/*.d.ts`, so **build the packages first** (`bun run build`, or use
`bun run build:docs` / the `docs.yml` workflow which does both). Public exported symbols
of those packages **should carry TSDoc** — missing docs surface as a build warning today;
this may become a
hard gate later.

### GitHub Pages — one-time repo settings

The docs site deploys via `.github/workflows/docs.yml`. A maintainer must set, once, in
the repository settings:

- **Settings → Pages → Build and deployment → Source = GitHub Actions.**
- When a custom domain is chosen: set it in **Settings → Pages → Custom domain**, add
  `apps/docs/static/CNAME` with the same value, flip `baseUrl` to `'/'` in
  `apps/docs/docusaurus.config.ts`, and enable **Enforce HTTPS**. Until then the site
  ships at `https://marmotz.github.io/kurotako/` (`baseUrl: '/kurotako/'`).

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
