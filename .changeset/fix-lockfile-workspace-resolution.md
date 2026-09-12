---
"@kurotako/parser-openapi": patch
"@kurotako/gen-typescript": patch
---

The previous fix (`@kurotako/parser-openapi@0.2.1`, `@kurotako/gen-typescript@0.3.1`) did not actually take effect: `bun.lock` had drifted from `package.json` (it still recorded `@kurotako/ir@0.2.0`, `@kurotako/core@0.1.1`, `@kurotako/config@0.1.1`), because `changeset version` bumps `package.json` and `CHANGELOG.md` but never refreshes the lockfile. `bun pm pack` resolves `workspace:^` from that lockfile, not from the live `package.json`, so the previously published tarballs still declared `"@kurotako/ir": "^0.2.0"`. `bun.lock` is now regenerated (`bun install`) and `.github/workflows/release.yml` runs `bun install` after `changeset version` so future "Version Packages" PRs carry a lockfile consistent with the bump.
