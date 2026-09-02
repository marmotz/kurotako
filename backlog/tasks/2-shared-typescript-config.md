# CI — Shared TypeScript config + project references

**Status**: done **Type**: CI **Issue**: [#2](https://github.com/marmotz/kurotako/issues/2)

Reference: [../features/monorepo-bootstrap/technical.md §TypeScript](../features/monorepo-bootstrap/technical.md#typescript).

## To do

1. Create `tsconfig.base.json` with the options from §TypeScript: `target` ES2022,
   `lib` ES2023, `module`/`moduleResolution` NodeNext, `strict`,
   `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `declaration`, `declarationMap`,
   `sourceMap`, `composite`, `incremental`, `isolatedModules`, `skipLibCheck`.
2. Create the root "solution" `tsconfig.json`: `{ "files": [], "references": [...] }`
   pointing to the 7 packages (the `path` values become valid once the packages exist).
3. Wire the root `typecheck` script = `tsc -b`.
4. Add `typescript` (>= 5.5) as a root devDependency.
5. Document the TS 5.5 floor on the consumer side (echoed in the README, meta task).

## Dependencies

- [#1](1-root-workspace-scaffold.md)

## Note

The root `tsc -b` will only really compile after
[#6](6-package-skeletons.md); this task lays down the files and the script.
