# CI — enable the release workflow (manual), fix job order, add provenance

**Status**: done **Type**: CI **Issue**: [#102](https://github.com/marmotz/kurotako/issues/102)
Reference: [../features/alpha-release/technical.md §5](../features/alpha-release/technical.md#5-releaseyml--keep-manual-publish-via-npm-oidc-no-token).

## Verified findings

- `.github/workflows/release.yml` is `workflow_dispatch`-only with a header comment
  "DISABLED until the MVP packages leave 0.0.0. No npm token is wired yet."
- Job steps run `bun install` → `bun run build` → `changesets/action@v1`
  (`version: bunx changeset version`, `publish: bunx changeset publish`), with
  `NPM_TOKEN` already referenced in `env`.
- `__TAKO_VERSION__` is injected at build time via tsup `define` from `package.json`
  `version` (`packages/cli/tsup.config.ts`, `packages/kurotako/tsup.config.ts`;
  consumed in `packages/cli/src/cli.ts:18-20`). Building before `changeset version`
  in the same run stamps bins with the pre-bump version.
- `ci.yml` already asserts the `kurotako` bin `--version` equals `package.json`
  `version` (Node + Bun).

## To do

1. Remove the "DISABLED" header comment; keep the trigger as `workflow_dispatch` only.
   Add a short comment describing the intended two-phase flow (dispatch → "Version
   Packages" PR → merge → dispatch again → publish).
2. Fix the build/version ordering so published bins carry the release version. Either:
   - split the bundled action into explicit steps: `changeset version` → `bun install`
     → `bun run build` → `changeset publish`; or
   - keep the action but drop the top-level `bun run build` and add a `prepublishOnly`
     (or `changeset publish` `--` build hook) so the build always runs post-version.
   Document the choice in a comment.
3. Add npm provenance: `permissions: id-token: write` on the job and
   `NPM_CONFIG_PROVENANCE: "true"` in `env` (or `--provenance` on the publish). Confirm
   the publish stays in GitHub Actions (it does).
4. Confirm `bunx changeset publish` resolves to `bun publish` (root
   `packageManager: "bun@1.4.0"`) so `workspace:^` ranges are rewritten to real
   versions. If not, add an explicit rewrite step.
5. `bunx changeset publish --dry-run` from a clean checkout as part of the task
   validation (no real publish here).

## Dependencies

- [#100](100-internal-deps-workspace-caret.md) — the
  `workspace:^` ranges must be in place for the dry-run to be meaningful.

## Notes

The npm org creation and `NPM_TOKEN` secret are tracked separately in
[#101](101-npm-org-and-token.md); this task does not need them until
the real publish ([#104](104-publish-010-tag-release.md)).
