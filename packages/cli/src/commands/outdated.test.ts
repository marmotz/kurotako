import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCli } from '../cli.js';

const PKG_DIR = join(import.meta.dirname, '..', '..');

let root: string;
let cwd: string;
let cacheDir: string;
let previousXdgCacheHome: string | undefined;
let stderr: string;
let stderrSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  root = mkdtempSync(join(PKG_DIR, 'tmp-outdated-'));
  mkdirSync(join(root, '.git'));
  cwd = process.cwd();
  process.chdir(root);
  process.exitCode = undefined;
  stderr = '';
  stderrSpy = vi
    .spyOn(process.stderr, 'write')
    .mockImplementation((c: string | Uint8Array) => {
      stderr += c.toString();
      return true;
    });

  // Isolate the version-check cache used internally by `runCli` (not under
  // test here) from the real `~/.cache`.
  cacheDir = mkdtempSync(join(PKG_DIR, 'tmp-outdated-cache-'));
  previousXdgCacheHome = process.env.XDG_CACHE_HOME;
  process.env.XDG_CACHE_HOME = cacheDir;
});

afterEach(() => {
  process.chdir(cwd);
  rmSync(root, { recursive: true, force: true });
  rmSync(cacheDir, { recursive: true, force: true });
  if (previousXdgCacheHome === undefined) {
    delete process.env.XDG_CACHE_HOME;
  } else {
    process.env.XDG_CACHE_HOME = previousXdgCacheHome;
  }
  stderrSpy.mockRestore();
  process.exitCode = undefined;
  vi.unstubAllGlobals();
});

function writeProjectPackageJson(dependencies: Record<string, string>): void {
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({ name: 'fixture', dependencies }),
  );
}

function installFakePackage(name: string, version: string): void {
  const dir = join(root, 'node_modules', name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, version }));
}

function stubRegistry(latestByName: Record<string, string | undefined>): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const name = decodeURIComponent(
        url.replace('https://registry.npmjs.org/', '').replace('/latest', ''),
      );
      const version = latestByName[name];
      if (version === undefined) {
        return { ok: false, status: 404 } as Response;
      }
      return {
        ok: true,
        json: async () => ({ version }),
      } as Response;
    }),
  );
}

describe('tako outdated', () => {
  it('reports an up-to-date and an outdated package, exit 0', async () => {
    writeProjectPackageJson({
      '@kurotako/core': '^1.0.0',
      '@kurotako/gen-zod': '^1.0.0',
    });
    installFakePackage('@kurotako/core', '1.0.0');
    installFakePackage('@kurotako/gen-zod', '1.0.0');
    stubRegistry({
      '@kurotako/core': '1.0.0',
      '@kurotako/gen-zod': '1.1.0',
    });

    await runCli(['outdated']);

    expect(process.exitCode ?? 0).toBe(0);
    expect(stderr).toMatch(/@kurotako\/core\s+1\.0\.0\s+1\.0\.0\s+up to date/);
    expect(stderr).toMatch(/@kurotako\/gen-zod\s+1\.0\.0\s+1\.1\.0\s+outdated/);
  });

  it('marks a package unresolvable on the registry as unknown, still exit 0', async () => {
    writeProjectPackageJson({ '@kurotako/core': '^1.0.0' });
    installFakePackage('@kurotako/core', '1.0.0');
    stubRegistry({ '@kurotako/core': undefined });

    await runCli(['outdated']);

    expect(process.exitCode ?? 0).toBe(0);
    expect(stderr).toMatch(/@kurotako\/core\s+1\.0\.0\s+unknown\s+unknown/);
  });

  it('ignores non-@kurotako dependencies', async () => {
    writeProjectPackageJson({ react: '^18.0.0' });
    stubRegistry({});

    await runCli(['outdated']);

    expect(process.exitCode ?? 0).toBe(0);
    expect(stderr).toContain('no @kurotako/* dependency found');
  });

  it('no package.json up to the project root: exit 0 with an error message', async () => {
    stubRegistry({});

    await runCli(['outdated']);

    expect(process.exitCode ?? 0).toBe(0);
    expect(stderr).toContain('no package.json found');
  });
});
