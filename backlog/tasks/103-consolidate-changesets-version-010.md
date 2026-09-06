# Release — consolidate changesets and version the workspace to 0.1.0

**Status**: done **Type**: release **Issue**: [#103](https://github.com/marmotz/kurotako/issues/103)
Reference: [../features/alpha-release/technical.md §1](../features/alpha-release/technical.md#1-reaching-010--single-changeset--changeset-version)
and [§7](../features/alpha-release/technical.md#7-readme-changelog-docs-prose).

## Verified findings

- All 8 `packages/*/package.json` are at `"version": "0.0.0"`.
- 6 unconsumed changesets under `.changeset/`: `drift-guard-plan.md`,
  `ir-model-schemas.md`, `meta-package-kurotako.md`, `monorepo-anchor-dir.md`,
  `outputs-array.md`, `tako-init-kurotako-import.md`. They describe merged features
  already archived under `backlog/_archives/`.
- `.changeset/config.json` `changelog: "@changesets/cli/changelog"`.

## To do

1. Delete the 6 changeset files listed above (keep `.changeset/README.md` and
   `config.json`).
2. Update `.changeset/README.md`: drop the "All packages stay at `0.0.0` / `0.x` until
   the MVP works end to end" / "release workflow left disabled" sentences.
3. Add `.changeset/initial-public-release.md` with all 8 packages at `minor` and the
   summary line `First public release.`
4. Run `bunx changeset version`. Expect: every `version` → `0.1.0`, a `CHANGELOG.md`
   created in each package, `workspace:^` ranges updated as needed, the changeset file
   consumed.
5. Add a light root `CHANGELOG.md`: point to `packages/*/CHANGELOG.md` and to
   <https://github.com/marmotz/kurotako/releases>.
6. `bun install` (lockfile), then `bun run typecheck && bun run test && bun run build`.
   Verify `node packages/kurotako/dist/bin/tako.js --version` prints `0.1.0` and
   `node packages/cli/dist/bin/tako.js --version` prints `0.1.0` (build-time
   `__TAKO_VERSION__`).
7. Commit on `develop` (or a PR into it).

## Dependencies

- [#100](100-internal-deps-workspace-caret.md)
- [#99](99-package-metadata-and-readmes.md)
