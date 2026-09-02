# CI — GitHub Actions workflow

**Status**: done **Type**: CI **Issue**: [#9](https://github.com/marmotz/kurotako/issues/9)

Reference: [../features/monorepo-bootstrap/technical.md §CI — GitHub Actions](../features/monorepo-bootstrap/technical.md#ci--github-actions).

## To do

1. Create `.github/workflows/ci.yml`, triggers `push` + `pull_request`, a single job
   `check` on `ubuntu-latest`:
   `checkout` → `oven-sh/setup-bun@v2` (bun-version from `package.json`) →
   `actions/setup-node@v4` (node 24) → `bun install --frozen-lockfile` →
   `bun run typecheck` → `bun run lint` → `bun run test` → `bun run build` → smoke
   `node packages/cli/dist/bin/tako.js --version` → smoke `bun packages/cli/dist/bin/tako.js --version`.
2. Add the changesets release workflow (`version` PR + `publish` on merge), left **disabled** (`workflow_dispatch` only,
   no `npm` token wired) until there is something publishable — i.e. the MVP packages leave `0.0.0`.
3. No Node matrix for now (Node 24 only); add it when there is real runtime code.

## Dependencies

- [#6](6-package-skeletons.md)
- [#8](8-changesets-release.md)
