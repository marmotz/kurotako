import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { build } from 'tsup';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

const pkgRoot = fileURLToPath(new URL('../../', import.meta.url));
const pkgVersion = (
  JSON.parse(readFileSync(path.join(pkgRoot, 'package.json'), 'utf8')) as {
    version: string;
  }
).version;

let binPath: string;
let workdir: string;

async function runTako(
  args: string[],
  cwd: string,
): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [binPath, ...args],
      { cwd },
    );
    return { stdout, stderr, code: 0 };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
      code: e.code ?? 1,
    };
  }
}

beforeAll(async () => {
  // Build the real bin the way `tsup.config.ts` does: ESM-only, `__TAKO_VERSION__`
  // injected from *this* package's `package.json`, `@kurotako/cli` left external
  // (resolved at runtime from `packages/kurotako/node_modules`).
  // Must sit inside the package so the built file resolves `@kurotako/cli` from
  // `packages/kurotako/node_modules`. Kept out of `dist/` so it never shadows the
  // real `bun run build` output; removed in `afterAll`.
  const outDir = path.join(pkgRoot, 'dist-test');
  await rm(outDir, { recursive: true, force: true });
  await build({
    entry: { 'bin/tako': path.join(pkgRoot, 'src/bin/tako.ts') },
    outDir,
    format: ['esm'],
    target: 'node24',
    dts: false,
    sourcemap: false,
    clean: false,
    silent: true,
    // Programmatic `build()` reads externals from the repo-root `package.json`, not
    // this package's — pin `@kurotako/cli` external explicitly (its own deps then
    // stay external transitively, since it is not bundled).
    external: ['@kurotako/cli'],
    define: { __TAKO_VERSION__: JSON.stringify(pkgVersion) },
  });
  binPath = path.join(outDir, 'bin/tako.js');
  workdir = await mkdtemp(path.join(tmpdir(), 'kurotako-bin-'));
}, 60_000);

afterAll(async () => {
  await rm(workdir, { recursive: true, force: true });
  await rm(path.join(pkgRoot, 'dist-test'), { recursive: true, force: true });
});

describe('kurotako bin', () => {
  it('--version prints this package’s own injected version, exit 0', async () => {
    // Independent of `@kurotako/cli`'s version: the meta bin resolves
    // `__TAKO_VERSION__` from `kurotako`'s own `package.json`.
    const { stdout, code } = await runTako(['--version'], workdir);
    expect(stdout.trim()).toBe(pkgVersion);
    expect(code).toBe(0);
  });

  it('-v is an alias for --version', async () => {
    const { stdout, code } = await runTako(['-v'], workdir);
    expect(stdout.trim()).toBe(pkgVersion);
    expect(code).toBe(0);
  });

  it('--help exits 0 with usage text mentioning the commands', async () => {
    const { stdout, code } = await runTako(['--help'], workdir);
    expect(code).toBe(0);
    expect(stdout).toContain('USAGE');
    expect(stdout).toMatch(/generate/);
  });

  it('generate in an empty dir hits the ConfigNotFoundError path, exit 1', async () => {
    const { stderr, code } = await runTako(['generate'], workdir);
    expect(code).toBe(1);
    expect(stderr.toLowerCase()).toContain('config');
  });
});
