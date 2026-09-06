# Root — exclude `examples/` from root tooling, add `examples/README.md`

**Statut** : fait
**Type** : chore
**Issue** : [#77](https://github.com/marmotz/kurotako/issues/77)

Référence : [../features/e2e-examples/technical.md §.gitignore / biome.json additions](../features/e2e-examples/technical.md#gitignore--biomejson-additions).

## Constat vérifié

- `biome.json` `files.includes` ([biome.json:8-18](../../../biome.json)) is `["**", "!**/dist", "!**/coverage", "!**/*.tsbuildinfo", "!apps/docs/build", "!apps/docs/.docusaurus", "!apps/docs/docs/api", "!apps/docs/versioned_docs"]` — no `examples/` exclusion yet.
- `.gitignore` ([.gitignore](../../../.gitignore)) has generic `node_modules`/`dist`/`coverage`/`*.tsbuildinfo` entries plus per-package `tmp-*` lines, and an `apps/docs` build-output block — no `examples/` entries yet.
- Root `package.json` `workspaces: ["packages/*", "apps/*"]` ([package.json:5-8](../../../package.json)) and root `vitest.config.ts` (`test.projects: ['packages/*/vitest.config.ts']`) already do not reach `examples/*` — no change needed there.

## À faire

1. Add to `.gitignore`:
   ```gitignore
   # examples/ — regenerable tako output, not committed
   examples/*/apps/*/generated
   examples/*/packages/*/src
   examples/*/packages/*/dist
   examples/*/packages/*/package.json
   examples/*/packages/*/tsconfig.json
   ```
2. Add `"!examples/**"` to `biome.json`'s `files.includes` array (same pattern as the `apps/docs/*` entries).
3. Create `examples/README.md`: short root-level doc listing both example projects (once they exist) and the support matrix each one exercises (parser version × output mode), pointing to each project's own `README.md` for setup steps. Can be written now with both project names and a one-line description each, even before the scaffolding tasks land.

## Dépendances

Aucune.
