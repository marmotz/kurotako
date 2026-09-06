# backend — @kurotako/core packageWriter.plan() (mode B, no build/install)

**Status**: done
**Type**: backend
**Issue**: [#52](https://github.com/marmotz/kurotako/issues/52)

Reference: [../features/drift-guard/technical.md §`Writer` interface addition](../features/drift-guard/technical.md#writer-interface-addition-core-writertypests-task-20),
[§Consequences — `output-modes/technical.md`](../features/drift-guard/technical.md#output-modestechnicalmd-task-50).

## Verified

- [#50](50-output-package-writer.md) creates `packages/core/src/writer/package.ts`
  (`packageWriter.write`): group `files` by namespace, wipe + recreate `<pkgDir>`, write
  `<pkgDir>/src/…` (`<ns>/` prefix stripped), synthesize `package.json`
  (`version: "0.0.0"`, sorted `peerDependencies`, fixed key order, `"//"` marker),
  `tsconfig.json`, `tsup.config.ts`, `<pkgDir>/.gitattributes`,
  `<packagesDir>/.gitattributes`; then tsup `build()` per package and one `<pm> install`;
  returns the sorted source paths (no `dist/`). `OutputNotGeneratedError` guards the wipe.
- [51-core-writer-plan](51-core-writer-plan.md) adds `Writer.plan(input):
  Promise<PlannedFile[]>` and refactors `directoryWriter` so `write()` builds on `plan()`;
  `packageWriter` still lacks `plan()`.

## To do

1. `packages/core/src/writer/package.ts` — extract the **deterministic layout** into
   `plan({ files, output })`:
   - group by namespace, compute each `<pkgDir>`;
   - `<pkgDir>/src/<path with the `<ns>/` prefix stripped>` for every `VirtualFile`;
   - synthesized `<pkgDir>/package.json` (identical bytes to `write()` — frozen
     `version: "0.0.0"`, sorted `peerDependencies` from `collectPeerDependencies`, fixed
     key order, `"//"` marker), `<pkgDir>/tsconfig.json`, `<pkgDir>/tsup.config.ts` (each
     with the banner comment), `<pkgDir>/.gitattributes`, `<packagesDir>/.gitattributes`;
   - **no** `dist/` entry, **no** `import('tsup')`, **no** `pm install`, no `fs` write.
   - Return `PlannedFile[]` sorted by `path`.
2. Refactor `packageWriter.write` to `const planned = await this.plan(input)`, then:
   wipe + recreate each `<pkgDir>` (keep the `OutputNotGeneratedError` marker guard),
   `writeFile` every `planned` entry, then the tsup `build()` per package and the
   `<pm> install` (unchanged). Return `planned.map(p => p.path)` (still source-only, no
   `dist/`).
3. `packages/core/src/writer/index.ts` — remove the "plan() added later" note; `plan()` is
   now total over both modes.
4. Tests (colocated vitest, temp dir):
   - `package.test.ts`: `plan()` → `<pkgDir>/src/…` prefix stripped, `package.json` /
     `tsconfig.json` / `tsup.config.ts` / `.gitattributes` present, `version: "0.0.0"`,
     sorted `peerDependencies`; **no** `dist/` entry; **no subprocess spawned**, no `fs`
     write (spy); byte-identical to the files `write()` produces for `src/` + manifest.
   - determinism: same IR + config → identical `plan()` output on a second call.
5. `bun run typecheck`, `bun run test`, `bun run build` green.

## Dependencies

- [50-output-package-writer](50-output-package-writer.md)
- [51-core-writer-plan](51-core-writer-plan.md)
