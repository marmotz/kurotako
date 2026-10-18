# @kurotako/gen-react-tanstack

## 0.2.0

### Minor Changes

- 147a177: Mode B packages now resolve their generator sub-paths: the generated `package.json` declares an explicit `exports` entry (`types`, `import`, `require`) for every generator in the namespace, so `<scope>/<ns>/zod`, `/typescript` and `/angular` resolve their `dist/<generator>/index.*` instead of the non-existent `dist/<generator>.js` (`ERR_MODULE_NOT_FOUND` / `TS2307`). The `./*` pattern still serves single files, so `<scope>/<ns>/zod/index` keeps working.
  
  Breaking: the synthesized root barrel `<ns>/index.ts` no longer re-exports UI-framework generators. `GeneratorArtifact` gains `exportFromRoot` (default `true`); `gen-angular` and `gen-react-tanstack` set it to `false`, so importing `<scope>/<ns>` from a plain Node process no longer loads `@angular/forms` or `@tanstack/react-form`. Import those from `<scope>/<ns>/angular` or `<scope>/<ns>/react-tanstack`.

### Patch Changes

- Updated dependencies [147a177]
- Updated dependencies [147a177]
- Updated dependencies [147a177]
- Updated dependencies [3050057]
  - @kurotako/ir@0.7.0
  - @kurotako/gen-zod@0.5.0
  - @kurotako/core@0.4.0
  - @kurotako/config@0.2.1

## 0.1.0

### Minor Changes

- 0ea85b1: New package: a generator that emits one typed React + TanStack Form hook per entity
  (`use<Entity>Form`), validated by the Zod schemas of a private `@kurotako/gen-zod` copy
  emitted under `<namespace>/react-tanstack/zod/`. Options: `zodVersion`, `include`,
  `variants` (`full` / `create` / `update`) and `relations` (`flat` / `deep`).

### Patch Changes

- Updated dependencies [f58eccc]
- Updated dependencies [f58eccc]
- Updated dependencies [f58eccc]
- Updated dependencies [0ea85b1]
  - @kurotako/config@0.2.0
  - @kurotako/core@0.3.0
  - @kurotako/gen-zod@0.4.0
  - @kurotako/ir@0.6.0
