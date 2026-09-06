# CI — docs site scaffold (apps/docs, Docusaurus)

**Status**: done **Type**: CI **Issue**: [#55](https://github.com/marmotz/kurotako/issues/55)

Reference: [../features/docs-site/technical.md §Package — apps/docs](../features/docs-site/technical.md#package--appsdocs)
and [§Site generator — Docusaurus 3](../features/docs-site/technical.md#site-generator--docusaurus-3).

## Verified state

No `apps/` directory exists. Task [#54](54-apps-docs-workspace-accommodation.md) adds
`"apps/*"` to the root `workspaces`, the `.gitignore` / `biome.json` exclusions and the
`CONTRIBUTING.md` docs section. This task creates the site package itself so that
`bun run --filter '@kurotako/docs' build` produces a static site with an (almost) empty
content tree.

## To do

1. Create `apps/docs/package.json`: `"name": "@kurotako/docs"`, `"private": true`,
   `"type": "module"`, no `"publishConfig"`. Dev dependencies: `@docusaurus/core`,
   `@docusaurus/preset-classic`, `@docusaurus/tsconfig`, `@docusaurus/types`, `react`,
   `react-dom`, `typescript`. Scripts: `start` (`docusaurus start`), `build`
   (`docusaurus build`), `serve` (`docusaurus serve`), `typecheck` (`docusaurus typecheck`),
   `docusaurus` (`docusaurus`).
2. `apps/docs/tsconfig.json`: `extends "@docusaurus/tsconfig"`, `compilerOptions.baseUrl`.
   **Not** `composite`, **not** added to the root solution `tsconfig.json` references
   (see [#54](54-apps-docs-workspace-accommodation.md) step 6).
3. `apps/docs/docusaurus.config.ts`:
   - `title`, `tagline` (from
     [docs/vision.md](https://github.com/marmotz/kurotako/blob/main/docs/vision.md)),
     `favicon`.
   - `url`/`baseUrl`: default to `https://marmotz.github.io` + `/kurotako/`; leave a
     commented `baseUrl: '/'` + custom-domain note (the domain is an open point in the
     technical design). The deploy task wires the final value.
   - `organizationName: 'marmotz'`, `projectName: 'kurotako'`.
   - `presets: [['classic', { docs: { routeBasePath: '/', sidebarPath: './sidebars.ts',
     editUrl: 'https://github.com/marmotz/kurotako/tree/main/apps/docs/' }, blog: false,
     theme: { customCss: './src/css/custom.css' } }]]`.
   - `themeConfig.navbar`: title + a `{ type: 'docsVersionDropdown' }` item (stays hidden
     until `versions.json` is non-empty) + a GitHub link.
   - `themeConfig.footer`, `themeConfig.prism`.
   - Local search: add `@easyops-cn/docusaurus-search-local` as a theme (lean
     local-search for launch, per the technical design open points) OR leave a TODO if
     the plugin choice is deferred — pick local-search here to keep the build
     self-contained.
4. `apps/docs/sidebars.ts`: a manual sidebar covering `getting-started/*`, `concepts/*`,
   `reference/*`; export it so the API-reference task can splice in its generated slice.
5. `apps/docs/src/css/custom.css`: Docusaurus theme tokens (Infima variables), minimal.
6. `apps/docs/docs/intro.md` (or `index.md`): a placeholder landing page so the build
   passes before the content task lands. Real pages come in the content task.
7. `apps/docs/static/`: `.nojekyll` (empty). `CNAME` is added by the deploy task.
8. Run `bun install` at the root, commit the updated `bun.lock`.
9. Verify `bun run --filter '@kurotako/docs' build` and `... typecheck` succeed locally.

## Dependencies

- [#54](54-apps-docs-workspace-accommodation.md) — `apps/*` workspace + root-file
  exclusions.
