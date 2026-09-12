# @kurotako/config

## 0.1.3

### Patch Changes

- c1437da: Same root cause as the `parser-openapi`/`gen-typescript` fix (`fix-stale-ir-dependency-range`, `fix-lockfile-workspace-resolution`): every package published before the `bun.lock` / release-workflow fix still carries a stale internal dependency range from the drifted lockfile.
  
  - `@kurotako/core@0.1.2` and `@kurotako/config@0.1.2` declare `"@kurotako/ir": "^0.2.0"`. `@kurotako/core` is what actually runs IR validation during `tako generate` — with this stale range, its own nested `@kurotako/ir@0.2.0` copy gets resolved instead of `^0.3.0`, so `array`/`map` field types still fail validation even with `parser-openapi@0.2.2`/`gen-typescript@0.3.2` installed.
  - `@kurotako/parser-prisma@0.2.1`, `@kurotako/gen-zod@0.3.0` and `@kurotako/gen-angular@0.2.0` declare the same stale `"@kurotako/ir": "^0.2.0"`.
  - `@kurotako/cli@0.1.1` declares `"@kurotako/core": "^0.1.1"` / `"@kurotako/config": "^0.1.1"`, both below the packages' actual current versions.
  
  No source change needed anywhere (`workspace:^` already resolves correctly with the fixed release workflow); this changeset only forces the patch releases needed to publish corrected tarballs.
- Updated dependencies [c1437da]
  - @kurotako/core@0.1.3

## 0.1.2

### Patch Changes

- Updated dependencies [9fe08b3]
- Updated dependencies [ecdb02c]
- Updated dependencies [22e6559]
  - @kurotako/ir@0.3.0
  - @kurotako/core@0.1.2

## 0.1.1

### Patch Changes

- Updated dependencies [489a50d]
- Updated dependencies [c575bc1]
- Updated dependencies [7a50439]
  - @kurotako/core@0.1.1
  - @kurotako/ir@0.2.0

## 0.1.0

### Minor Changes

- First public release.

### Patch Changes

- Updated dependencies
  - @kurotako/ir@0.1.0
  - @kurotako/core@0.1.0
