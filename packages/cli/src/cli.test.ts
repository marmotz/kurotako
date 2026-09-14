import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import pkg from '../package.json' with { type: 'json' };
import { runCli } from './cli.js';
import { writeCache } from './version-check.js';

let stdout: string;
let stderr: string;
let stdoutSpy: ReturnType<typeof vi.spyOn>;
let stderrSpy: ReturnType<typeof vi.spyOn>;
let cacheDir: string;
let previousXdgCacheHome: string | undefined;

beforeEach(() => {
  stdout = '';
  stderr = '';
  process.exitCode = undefined;
  stdoutSpy = vi
    .spyOn(process.stdout, 'write')
    .mockImplementation((c: string | Uint8Array) => {
      stdout += c.toString();
      return true;
    });
  stderrSpy = vi
    .spyOn(process.stderr, 'write')
    .mockImplementation((c: string | Uint8Array) => {
      stderr += c.toString();
      return true;
    });

  // Isolate the version-check cache from the real `~/.cache`, and make sure
  // no test ever reaches the real npm registry: default to a cache entry
  // that is already fresh (no refresh needed, no notice).
  cacheDir = mkdtempSync(join(tmpdir(), 'kurotako-cli-test-'));
  previousXdgCacheHome = process.env.XDG_CACHE_HOME;
  process.env.XDG_CACHE_HOME = cacheDir;
  writeCache({ checkedAt: Date.now(), latestVersion: pkg.version });
});

afterEach(() => {
  stdoutSpy.mockRestore();
  stderrSpy.mockRestore();
  process.exitCode = undefined;
  rmSync(cacheDir, { recursive: true, force: true });
  if (previousXdgCacheHome === undefined) {
    delete process.env.XDG_CACHE_HOME;
  } else {
    process.env.XDG_CACHE_HOME = previousXdgCacheHome;
  }
  vi.unstubAllGlobals();
});

describe('runCli', () => {
  it('--version prints the injected version on stdout, exit 0', async () => {
    await runCli(['--version']);
    expect(stdout.trim()).toBe(pkg.version);
    expect(process.exitCode ?? 0).toBe(0);
  });

  it('no args prints usage, exit 0', async () => {
    await runCli([]);
    expect(stdout).toContain('USAGE');
    expect(process.exitCode ?? 0).toBe(0);
  });

  it('--help prints usage, exit 0', async () => {
    await runCli(['--help']);
    expect(stdout).toContain('USAGE');
  });

  it('an unknown command exits 1 with citty’s message', async () => {
    await runCli(['nope']);
    expect(process.exitCode).toBe(1);
    expect(stderr.toLowerCase()).toContain('unknown command');
  });

  it('an unknown top-level flag exits 1', async () => {
    await runCli(['--bogus']);
    expect(process.exitCode).toBe(1);
  });

  it('prints a version-check notice against the supplied currentVersion, not the package version', async () => {
    writeCache({ checkedAt: Date.now(), latestVersion: '999.0.0' });
    await runCli(['nope'], { currentVersion: '1.0.0' });
    expect(stderr).toContain('1.0.0 → 999.0.0');
  });

  it('no notice when currentVersion is not supplied and the cache is already up to date', async () => {
    await runCli(['nope']);
    expect(stderr).not.toContain('new version of kurotako is available');
  });

  it('a never-resolving registry refresh does not delay runCli, and is aborted', async () => {
    rmSync(cacheDir, { recursive: true, force: true });
    let receivedSignal: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: { signal?: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            receivedSignal = init?.signal;
            init?.signal?.addEventListener('abort', () =>
              reject(new Error('aborted')),
            );
          }),
      ),
    );

    await runCli(['nope'], { currentVersion: '1.0.0' });

    expect(process.exitCode).toBe(1);
    expect(receivedSignal?.aborted).toBe(true);
  });
});
