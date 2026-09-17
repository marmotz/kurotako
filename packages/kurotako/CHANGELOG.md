# kurotako

## 0.2.3

### Patch Changes

- 7e3a70e: Pin the umbrella package's internal dependencies (`@kurotako/cli`, `@kurotako/config`, `@kurotako/gen-typescript`) to `workspace:*` instead of `workspace:^`.
  
  With `workspace:^`, a patch release of one of these packages could stay inside `kurotako`'s already-published dependency range, so changesets would skip bumping `kurotako` and consumers had no visible signal (new version, changelog) that a fix existed — `@kurotako/cli` in particular is never installed directly by app authors. Pinning to the exact resolved version guarantees every internal change is republished as a new `kurotako` version.

## 0.2.2

### Patch Changes

- c76afb9: The `tako` binary now passes its own installed version to `@kurotako/cli`'s
  background version-check, so the "a new version is available" notice compares
  against the `kurotako` version you actually installed.
- Updated dependencies [c76afb9]
  - @kurotako/cli@0.2.0

## 0.2.1

### Patch Changes

- Updated dependencies [9fe08b3]
- Updated dependencies [ecdb02c]
- Updated dependencies [22e6559]
  - @kurotako/gen-typescript@0.3.0
  - @kurotako/cli@0.1.1
  - @kurotako/config@0.1.2

## 0.2.0

### Minor Changes

- 489a50d: Re-export `typescriptGenerator` from the umbrella package.

### Patch Changes

- Updated dependencies [489a50d]
  - @kurotako/gen-typescript@0.2.0
  - @kurotako/config@0.1.1

## 0.1.0

### Minor Changes

- First public release.

### Patch Changes

- Updated dependencies
  - @kurotako/config@0.1.0
  - @kurotako/cli@0.1.0
