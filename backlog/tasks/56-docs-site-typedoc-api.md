# CI — docs site API reference (TypeDoc)

**Status**: to do **Type**: CI **Issue**: [#56](https://github.com/marmotz/kurotako/issues/56)

Reference: [../features/docs-site/technical.md §API reference — TypeDoc](../features/docs-site/technical.md#api-reference--typedoc).

## Verified state

The scaffold task creates `apps/docs` with a manual `sidebars.ts`. The four public
packages (`@kurotako/ir`, `core`, `config`, `cli`) each expose a `src/index.ts` barrel
(from [monorepo-bootstrap #6](6-package-skeletons.md) and their respective feature
tasks). This task wires a build-time TypeDoc pass so the site publishes a generated API
reference frozen together with each docs version.

## To do

1. Add dev dependencies to `apps/docs/package.json`: `typedoc`, `typedoc-plugin-markdown`,
   `docusaurus-plugin-typedoc`.
2. `apps/docs/docusaurus.config.ts`: add `docusaurus-plugin-typedoc` to `plugins` with:
   - `entryPointStrategy: 'packages'`, `entryPoints: ['../../packages/ir',
     '../../packages/core', '../../packages/config', '../../packages/cli']`.
   - `out: 'docs/api'`, `readme: 'none'`.
   - `typedoc-plugin-markdown` options for Docusaurus-friendly output (frontmatter,
     `hidePageTitle` as needed).
   - `validation: { notDocumented: true }` surfaced as a **warning** (not a hard failure)
     in the build.
3. `apps/docs/.gitignore` (or the root entry from [#54](54-apps-docs-workspace-accommodation.md)):
   confirm `apps/docs/docs/api/` is ignored on `next` (regenerated every build); frozen
   copies under `versioned_docs/version-*/api/` are committed.
4. `apps/docs/sidebars.ts`: splice the generated API sidebar slice (the plugin emits
   `typedoc-sidebar.cjs` or equivalent) under an "API" category, after `reference/`.
5. Record the TSDoc-coverage expectation: public exported symbols of the four packages
   should carry TSDoc. Add a short note to
   [CONTRIBUTING.md](https://github.com/marmotz/kurotako/blob/main/CONTRIBUTING.md)
   (created in [#10](10-repo-meta-files.md)) — soft warning now, possible hard gate
   later.
6. Verify `bun run --filter '@kurotako/docs' build` regenerates `docs/api/` and the API
   pages render with working sidebar links.

## Dependencies

- [55-docs-site-scaffold](55-docs-site-scaffold.md) — the `apps/docs` package.
- [#14](14-ir-source-builder.md) — `@kurotako/ir` public surface complete.
- [#21](21-core-run.md) — `@kurotako/core` public surface complete.
- [#25](25-config-load.md) — `@kurotako/config` public surface complete.
- [#44](44-cli-scaffold-reporter-errors.md) — `@kurotako/cli` programmatic entry
  (`runCli`) exists.
