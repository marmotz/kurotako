# CI — docs site deployment workflow (GitHub Pages)

**Status**: done **Type**: CI **Issue**: [#57](https://github.com/marmotz/kurotako/issues/57)

Reference: [../features/docs-site/technical.md §Deployment — GitHub Pages](../features/docs-site/technical.md#deployment--github-pages).

## Verified state

`ci.yml` (from [monorepo-bootstrap #9](9-ci-workflow.md)) is the toolchain workflow and is
**not** touched by this task. The docs site ships its own dedicated workflow. GitHub Pages
on `marmotz/kurotako` requires the repo to be public (settled in the overview) and
"Build and deployment / Source = GitHub Actions" set once in repo settings (manual step,
documented here).

## To do

1. Create `.github/workflows/docs.yml`:
   - Triggers: `push` to `main` with `paths` `apps/docs/**`, `packages/*/src/**`,
     `.github/workflows/docs.yml`; plus `workflow_dispatch`.
   - `permissions: { contents: read, pages: write, id-token: write }`,
     `concurrency: { group: pages, cancel-in-progress: false }`.
   - `build` job: `actions/checkout@v4`, `oven-sh/setup-bun@v2`
     (`bun-version-file: package.json`), `bun install --frozen-lockfile`,
     `bun run --filter '@kurotako/docs' build`, `actions/upload-pages-artifact@v3`
     (`path: apps/docs/build`).
   - `deploy` job: `needs: build`, `environment: github-pages`,
     `actions/deploy-pages@v4`.
2. Custom domain: add `apps/docs/static/CNAME` with the chosen domain (an open point —
   if still undecided, ship without `CNAME`, keep `baseUrl: '/kurotako/'`, and leave a
   one-line TODO). When the domain is set: `baseUrl: '/'` in `docusaurus.config.ts`,
   `CNAME` file, and enable "Enforce HTTPS" in repo settings.
3. Document the one-time repo settings in
   [CONTRIBUTING.md](https://github.com/marmotz/kurotako/blob/main/CONTRIBUTING.md):
   Pages source = GitHub Actions, custom domain field, HTTPS enforcement.
4. Confirm the first run deploys and the site is reachable.

## Dependencies

- [55-docs-site-scaffold](55-docs-site-scaffold.md) — a buildable `apps/docs`.
