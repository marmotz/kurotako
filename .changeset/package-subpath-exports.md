---
'kurotako': minor
'@kurotako/core': minor
'@kurotako/gen-angular': minor
'@kurotako/gen-react-tanstack': minor
---

Mode B packages now resolve their generator sub-paths: the generated `package.json` declares an explicit `exports` entry (`types`, `import`, `require`) for every generator in the namespace, so `<scope>/<ns>/zod`, `/typescript` and `/angular` resolve their `dist/<generator>/index.*` instead of the non-existent `dist/<generator>.js` (`ERR_MODULE_NOT_FOUND` / `TS2307`). The `./*` pattern still serves single files, so `<scope>/<ns>/zod/index` keeps working.

Breaking: the synthesized root barrel `<ns>/index.ts` no longer re-exports UI-framework generators. `GeneratorArtifact` gains `exportFromRoot` (default `true`); `gen-angular` and `gen-react-tanstack` set it to `false`, so importing `<scope>/<ns>` from a plain Node process no longer loads `@angular/forms` or `@tanstack/react-form`. Import those from `<scope>/<ns>/angular` or `<scope>/<ns>/react-tanstack`.
