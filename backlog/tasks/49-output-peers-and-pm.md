# backend — output mode B: peer-dependency aggregation and package-manager resolution

**Status**: to do **Type**: backend **Issue**: [#49](https://github.com/marmotz/kurotako/issues/49)

Reference: [../features/output-modes/technical.md §`packageWriter` (mode B)](../features/output-modes/technical.md#packagewriter-mode-b) step 4,
[§Package manager (mode B)](../features/output-modes/technical.md#package-manager-mode-b).

## Verified

- `GeneratorArtifact.peerDependencies?: Record<string, string>` and the error classes
  `OutputPeerConflictError` / `PackageInstallError` are declared by
  [#15](15-core-types-and-contracts.md).
- `OutputConfig` (from [#15](15-core-types-and-contracts.md)) carries
  `packageManager?: 'bun' | 'pnpm' | 'yarn' | 'npm'` and an absolute `packagesDir?`.
- Disk access via `node:fs/promises`, subprocess via `node:child_process` — no `Bun.*`.

## To do

1. `packages/core/src/writer/peers.ts`:
   - `export function collectPeerDependencies(artifactsByGenerator: Record<string, GeneratorArtifact>, files: VirtualFile[]): Record<string, Record<string, string>>`
     — per namespace, union the `peerDependencies` of every generator that contributed a
     file under `<ns>/<name>/`. Same package with two different ranges →
     `OutputPeerConflictError { namespace, package, ranges, generators }` (fail-fast).
     Identical ranges de-duplicate. Result keys sorted.
2. `packages/core/src/writer/pm.ts`:
   - `export type PackageManager = 'bun' | 'pnpm' | 'yarn' | 'npm'`.
   - `export function resolvePackageManager(opts: { configured?: PackageManager; startDir: string }): PackageManager | null`
     — order: `configured` → lockfile walk-up from `startDir` (`bun.lock` / `bun.lockb` →
     `bun`; `pnpm-lock.yaml` → `pnpm`; `yarn.lock` → `yarn`; `package-lock.json` → `npm`;
     stop at `.git` or filesystem root) → nearest ancestor `package.json` `packageManager`
     field (name before `@`) → `null`.
   - `export async function runInstall(pm: PackageManager, cwd: string): Promise<void>` —
     promisified `execFile(pm, ['install'], { cwd })`, no `--frozen-lockfile`, stdio
     inherited at `debug` level. Non-zero exit → `PackageInstallError { pm, cause }`.
3. `packages/core/src/writer/*.test.ts`:
   - `peers`: union of two disjoint sets; identical range de-dupes; conflicting ranges →
     `OutputPeerConflictError` naming both generators.
   - `pm`: `configured` wins; `bun.lockb` two dirs up → `bun`; `packageManager` field
     fallback; nothing → `null`, no throw; `runInstall` non-zero exit → `PackageInstallError`.
4. `bun run typecheck`, `bun run test`, `bun run build` green.

## Dependencies

- [15-core-types-and-contracts](15-core-types-and-contracts.md)
