# Packages — publish metadata and per-package READMEs

**Status**: done **Type**: packages **Issue**: [#99](https://github.com/marmotz/kurotako/issues/99)
Reference: [../features/alpha-release/technical.md §6](../features/alpha-release/technical.md#6-per-package-packagejson-metadata).

## Verified findings

- None of the 8 publishable `packages/*/package.json` carry `description`, `keywords`,
  `license`, `author`, `homepage`, `repository` or `bugs`.
- No `packages/*/README.md` exists.
- `files: ["dist"]` is set everywhere; `publishConfig.access = "public"` is set
  everywhere; `exports` / `main` / `module` / `types` are already present, and `bin`
  `tako` on `@kurotako/cli` and `kurotako`.

## To do

1. Add to each of `packages/{ir,core,config,cli,gen-zod,gen-angular,parser-prisma,kurotako}/package.json`:
   - `"description"`: one line specific to the package.
   - `"keywords"`: `["kurotako", "codegen", "typescript"]` + per-package terms
     (`prisma`, `zod`, `angular`, `valibot`, `cli`, `schema`).
   - `"license": "MIT"`, `"author": "Marmotz"`.
   - `"homepage": "https://kurotako.marmotz.dev/"`.
   - `"repository": { "type": "git", "url": "git+https://github.com/marmotz/kurotako.git", "directory": "packages/<name>" }`.
   - `"bugs": "https://github.com/marmotz/kurotako/issues"`.
2. Add `packages/<name>/README.md` for each: what it is, install line, minimal usage,
   link to the docs site. `kurotako` and `@kurotako/cli` get the fuller getting-started;
   the libraries (`ir`, `core`, `config`, `gen-*`, `parser-prisma`) get a short blurb +
   docs link.
3. Keep `files: ["dist"]` — npm bundles `README.md`, `LICENSE`, `CHANGELOG.md` on top.
4. `bun run typecheck && bun run test && bun run build` still green (metadata-only, but
   run it).

## Dependencies

None.
