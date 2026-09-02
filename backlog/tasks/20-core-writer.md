# backend — Writer seam and mode A directory writer

**Status**: to do **Type**: backend **Issue**: [#20](https://github.com/marmotz/kurotako/issues/20)

Reference: [../features/core-pipeline/technical.md §Writer seam](../features/core-pipeline/technical.md#writer-seam)
and [§Accepted risks](../features/core-pipeline/technical.md#accepted-risks).

## Verified

- Decided: `tako` is the exclusive owner of `output.dir` and wipes it unconditionally
  before generation — no run marker, no path guard
  ([../features/core-pipeline/technical.md §Accepted risks](../features/core-pipeline/technical.md#accepted-risks)).
- Mode B (`output.mode: 'package'`) is out of scope here — `packageWriter` is added to
  this same package by [output-modes](../features/output-modes/technical.md) (it decided
  the mode-B plumbing lives in `@kurotako/core`, not a separate package). This task ships
  `selectWriter` with the `'package'` branch still throwing `UnsupportedOutputModeError`.
- Disk access uses `node:fs/promises` only (no `Bun.*`, no `fs-extra`).

## To do

1. `packages/core/src/writer/` (a directory — output-modes adds `package.ts`, `barrel.ts`,
   `banner.ts`, `peers.ts`, `pm.ts` alongside):
   - `writer/types.ts` — `interface Writer { write(input: { files: VirtualFile[]; output: OutputConfig }): Promise<string[]> }`.
   - `writer/directory.ts` — `export const directoryWriter: Writer`:
     - resolve `output.dir` (absolute) — throw a `TakoError` if it is missing;
     - `fs.rm(dir, { recursive: true, force: true })` then `fs.mkdir(dir, { recursive: true })`;
     - write every file in sorted order, `mkdir -p` on each parent, utf-8;
     - write `<dir>/.gitattributes` (`* linguist-generated=true`);
     - return the sorted list of absolute paths written (`.gitattributes` included).
   - `writer/index.ts` — `export function selectWriter(output: OutputConfig): Writer` —
     `'dir'` or undefined → `directoryWriter`; `'package'` → throw
     `UnsupportedOutputModeError` (output-modes replaces this branch with `packageWriter`);
     anything else → `UnsupportedOutputModeError`. Re-export `Writer`, `directoryWriter`.
2. `packages/core/src/writer/*.test.ts` (real temp dir):
   - wipes a pre-existing file that is not re-emitted;
   - creates nested directories;
   - round-trips file content;
   - writes `.gitattributes`;
   - returns sorted absolute paths;
   - `selectWriter({ mode: 'package' })` throws `UnsupportedOutputModeError`.
3. `bun run typecheck`, `bun run test`, `bun run build` green.

## Dependencies

- [15-core-types-and-contracts](15-core-types-and-contracts.md)
