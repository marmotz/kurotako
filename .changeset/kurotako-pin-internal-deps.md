---
"kurotako": patch
---

Pin the umbrella package's internal dependencies (`@kurotako/cli`, `@kurotako/config`, `@kurotako/gen-typescript`) to `workspace:*` instead of `workspace:^`.

With `workspace:^`, a patch release of one of these packages could stay inside `kurotako`'s already-published dependency range, so changesets would skip bumping `kurotako` and consumers had no visible signal (new version, changelog) that a fix existed — `@kurotako/cli` in particular is never installed directly by app authors. Pinning to the exact resolved version guarantees every internal change is republished as a new `kurotako` version.
