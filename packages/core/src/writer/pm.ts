/**
 * Package-manager resolution and the mode-B `install` step. `tako generate` in
 * mode B links the freshly generated packages by running `<pm> install` once.
 * When no package manager can be resolved, `tako` does not guess — it prints
 * the command for the user to run.
 *
 * Disk access via `node:fs` (sync, resolution is cheap and one-shot),
 * subprocess via `node:child_process` — no `Bun.*`.
 *
 * Design: `backlog/features/output-modes/technical.md` §Package manager.
 */
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { PackageInstallError } from '../errors.js';

const execFileAsync = promisify(execFile);

export type PackageManager = 'bun' | 'pnpm' | 'yarn' | 'npm';

const PACKAGE_MANAGERS: readonly PackageManager[] = [
  'bun',
  'pnpm',
  'yarn',
  'npm',
];

const LOCKFILES: readonly [string, PackageManager][] = [
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['package-lock.json', 'npm'],
];

function isPackageManager(value: string): value is PackageManager {
  return (PACKAGE_MANAGERS as readonly string[]).includes(value);
}

export function* ancestors(startDir: string): Generator<string> {
  let dir = path.resolve(startDir);
  while (true) {
    yield dir;
    const parent = path.dirname(dir);
    if (parent === dir) {
      return;
    }
    dir = parent;
  }
}

/**
 * Resolve the package manager to run `install` with, in order:
 *   1. `configured` (from `output.packageManager`) — used verbatim;
 *   2. lockfile walk-up from `startDir` (`bun.lock` / `bun.lockb` -> `bun`,
 *      `pnpm-lock.yaml` -> `pnpm`, `yarn.lock` -> `yarn`,
 *      `package-lock.json` -> `npm`), stopping at a `.git` marker or the root;
 *   3. nearest ancestor `package.json` `packageManager` field (name before `@`);
 *   4. `null` — do not guess.
 */
export function resolvePackageManager(opts: {
  configured?: PackageManager;
  startDir: string;
}): PackageManager | null {
  if (opts.configured) {
    return opts.configured;
  }

  for (const dir of ancestors(opts.startDir)) {
    for (const [file, pm] of LOCKFILES) {
      if (existsSync(path.join(dir, file))) {
        return pm;
      }
    }
    if (existsSync(path.join(dir, '.git'))) {
      break;
    }
  }

  for (const dir of ancestors(opts.startDir)) {
    const pkgPath = path.join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
          packageManager?: unknown;
        };
        if (typeof pkg.packageManager === 'string') {
          const name = pkg.packageManager.split('@')[0] ?? '';
          if (isPackageManager(name)) {
            return name;
          }
        }
      } catch {
        // Unreadable / malformed package.json — keep walking up.
      }
    }
    if (existsSync(path.join(dir, '.git'))) {
      break;
    }
  }

  return null;
}

/**
 * Run `<pm> install` in `cwd`. No `--frozen-lockfile` — the generated packages
 * are new, the lockfile must change. A non-zero exit becomes
 * `PackageInstallError { pm, cause }`.
 */
export async function runInstall(
  pm: PackageManager,
  cwd: string,
): Promise<void> {
  try {
    await execFileAsync(pm, ['install'], { cwd });
  } catch (cause) {
    throw new PackageInstallError(pm, { cause });
  }
}
