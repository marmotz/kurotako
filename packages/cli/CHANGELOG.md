# @kurotako/cli

## 0.1.2

### Patch Changes

- c1437da: Same root cause as the `parser-openapi`/`gen-typescript` fix (`fix-stale-ir-dependency-range`, `fix-lockfile-workspace-resolution`): every package published before the `bun.lock` / release-workflow fix still carries a stale internal dependency range from the drifted lockfile.
  
  - `@kurotako/core@0.1.2` and `@kurotako/config@0.1.2` declare `"@kurotako/ir": "^0.2.0"`. `@kurotako/core` is what actually runs IR validation during `tako generate` — with this stale range, its own nested `@kurotako/ir@0.2.0` copy gets resolved instead of `^0.3.0`, so `array`/`map` field types still fail validation even with `parser-openapi@0.2.2`/`gen-typescript@0.3.2` installed.
  - `@kurotako/parser-prisma@0.2.1`, `@kurotako/gen-zod@0.3.0` and `@kurotako/gen-angular@0.2.0` declare the same stale `"@kurotako/ir": "^0.2.0"`.
  - `@kurotako/cli@0.1.1` declares `"@kurotako/core": "^0.1.1"` / `"@kurotako/config": "^0.1.1"`, both below the packages' actual current versions.
  
  No source change needed anywhere (`workspace:^` already resolves correctly with the fixed release workflow); this changeset only forces the patch releases needed to publish corrected tarballs.
- Updated dependencies [c1437da]
  - @kurotako/core@0.1.3
  - @kurotako/config@0.1.3

## 0.1.1

### Patch Changes

- 22e6559: Make the ambiguous root-barrel export warning understandable.
  
  - `@kurotako/core`: when several generators export identically-named
    declarations under one namespace, `synthesizeRootBarrels` now emits a single
    plain-language warning per namespace instead of one terse line per identifier.
    It says what caused the clash, that it is not an error, which import path
    yields which declaration, and how to silence it, plus a bounded deterministic
    sample of the affected names. The full per-identifier detail
    (`collisionCount`, `identifiers`, `sample`, `resolutions`) stays on the
    warning's structured meta object. The warning fires once from the aggregate
    tree rather than once per configured output, and the generated barrel content
    is unchanged.
  - `@kurotako/core`: `OutputNotGeneratedError` now explains the `"//"` marker and
    the two ways to unblock the path (delete the directory, or add the marker).
  - `@kurotako/cli`: `ConsoleReporter` prints the human-readable message at
    `info` / `warn` / `error` level and appends the structured `meta` object only
    with `--debug`. A custom `Logger` still receives `meta` in full, so default
    output stays prose instead of `key=value` noise.
- Updated dependencies [22e6559]
  - @kurotako/core@0.1.2
  - @kurotako/config@0.1.2

## 0.1.0

### Minor Changes

- First public release.

### Patch Changes

- Updated dependencies
  - @kurotako/core@0.1.0
  - @kurotako/config@0.1.0
