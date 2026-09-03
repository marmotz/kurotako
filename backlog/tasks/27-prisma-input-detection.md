# backend — @kurotako/parser-prisma input resolution and version-mode detection

**Status**: done **Type**: backend **Issue**: [#27](https://github.com/marmotz/kurotako/issues/27)

Reference: [../features/parser-prisma/technical.md §Version-mode detection (`detect.ts`)](../features/parser-prisma/technical.md#version-mode-detection-detectts).

## Verified

- `PrismaParserOptions` (`schema`, `version`) and the `PrismaInputError` class come from
  the scaffold task. `ParseContext.cwd` is the anchor for the relative `schema` path
  ([core-pipeline/technical.md §Orchestration step 1](../features/core-pipeline/technical.md#orchestration-algorithm-runts)).
- Decided: mode inferred from the input unless `options.version` forces it; multi-file
  Prisma (`prismaSchemaFolder`) is supported transparently; `contract.json` selects mode 8.

## To do

1. `packages/parser-prisma/src/detect.ts`:
   - ```ts
     export type ResolvedInput =
       | { mode: 7; kind: 'file' | 'folder'; files: Array<[string, string]> }
       | { mode: 8; kind: 'contract'; contractPath: string }
     export async function resolveInput(cwd: string, o: PrismaParserOptions): Promise<ResolvedInput>
     ```
   - Resolve `o.schema` against `cwd`; `stat` it (`node:fs/promises`).
   - `o.version` set → forces the mode; otherwise infer:
     - `*.prisma` file → `{ mode: 7, kind: 'file' }`;
     - directory → `{ mode: 7, kind: 'folder' }`: collect `*.prisma` non-recursively, then
       one level down (Prisma `prismaSchemaFolder` layout);
     - `contract.json` file, or directory containing one → `{ mode: 8 }`.
   - mode 7 → read each file into `[relativePath, content]` tuples (POSIX-relative to the
     resolved root, sorted, for determinism).
   - missing path / empty folder / no `.prisma` → `PrismaInputError` naming the resolved
     path.
2. `packages/parser-prisma/src/detect.test.ts` (temp dirs):
   - single `schema.prisma` → `mode 7`, `kind 'file'`, one tuple;
   - `prisma/` folder with `schema.prisma` + `user.prisma` → `kind 'folder'`, two tuples,
     sorted;
   - `contract.json` → `mode 8`;
   - `version: 8` on a `.prisma` file forces `mode 8`;
   - missing path → `PrismaInputError`.
3. `bun run typecheck`, `bun run test`, `bun run build` green.

## Dependencies

- [26-prisma-parser-scaffold](26-prisma-parser-scaffold.md)
