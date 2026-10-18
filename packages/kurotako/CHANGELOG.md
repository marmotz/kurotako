# kurotako

## 0.3.0

### Minor Changes

- 147a177: Mode B packages now resolve their generator sub-paths: the generated `package.json` declares an explicit `exports` entry (`types`, `import`, `require`) for every generator in the namespace, so `<scope>/<ns>/zod`, `/typescript` and `/angular` resolve their `dist/<generator>/index.*` instead of the non-existent `dist/<generator>.js` (`ERR_MODULE_NOT_FOUND` / `TS2307`). The `./*` pattern still serves single files, so `<scope>/<ns>/zod/index` keeps working.
  
  Breaking: the synthesized root barrel `<ns>/index.ts` no longer re-exports UI-framework generators. `GeneratorArtifact` gains `exportFromRoot` (default `true`); `gen-angular` and `gen-react-tanstack` set it to `false`, so importing `<scope>/<ns>` from a plain Node process no longer loads `@angular/forms` or `@tanstack/react-form`. Import those from `<scope>/<ns>/angular` or `<scope>/<ns>/react-tanstack`.

### Patch Changes

- Updated dependencies [147a177]
- Updated dependencies [147a177]
  - @kurotako/gen-typescript@0.5.0
  - @kurotako/config@0.2.1
  - @kurotako/cli@0.3.1

## 0.2.7

### Patch Changes

- Updated dependencies [fba5a64]
  - @kurotako/cli@0.3.0

## 0.2.6

### Patch Changes

- Updated dependencies [f58eccc]
- Updated dependencies [f58eccc]
  - @kurotako/config@0.2.0
  - @kurotako/gen-typescript@0.4.0
  - @kurotako/cli@0.2.2

## 0.2.5

### Patch Changes

- @kurotako/config@0.1.6
  - @kurotako/gen-typescript@0.3.6

## 0.2.4

### Patch Changes

- Updated dependencies [a3d63ef]
  - @kurotako/gen-typescript@0.3.5
  - @kurotako/config@0.1.5

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
