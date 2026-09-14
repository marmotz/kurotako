import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkForUpdate,
  compareVersions,
  readCache,
  refreshLatestVersion,
  writeCache,
} from './version-check.js';

let root: string;
let previousXdgCacheHome: string | undefined;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'kurotako-version-check-'));
  previousXdgCacheHome = process.env.XDG_CACHE_HOME;
  process.env.XDG_CACHE_HOME = root;
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  if (previousXdgCacheHome === undefined) {
    delete process.env.XDG_CACHE_HOME;
  } else {
    process.env.XDG_CACHE_HOME = previousXdgCacheHome;
  }
  vi.unstubAllGlobals();
});

describe('compareVersions', () => {
  it('orders by major, minor, patch', () => {
    expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
    expect(compareVersions('2.1.0', '2.0.9')).toBe(1);
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
  });

  it('a release outranks a prerelease of the same core version', () => {
    expect(compareVersions('1.0.0', '1.0.0-beta.1')).toBe(1);
    expect(compareVersions('1.0.0-beta.1', '1.0.0')).toBe(-1);
  });
});

describe('readCache / writeCache', () => {
  it('returns undefined when no cache file exists', () => {
    expect(readCache()).toBeUndefined();
  });

  it('round-trips an entry through the cache file', () => {
    writeCache({ checkedAt: 123, latestVersion: '1.2.3' });
    expect(readCache()).toEqual({ checkedAt: 123, latestVersion: '1.2.3' });
  });

  it('returns undefined for a corrupt cache file', () => {
    writeCache({ checkedAt: 123, latestVersion: '1.2.3' });
    writeFileSync(join(root, 'tako', 'version-check.json'), 'not json');
    expect(readCache()).toBeUndefined();
  });
});

describe('checkForUpdate', () => {
  it('no cache: no notice, but a refresh is offered', () => {
    const { notice, refresh } = checkForUpdate('1.0.0');
    expect(notice).toBeUndefined();
    expect(refresh).toBeDefined();
  });

  it('fresh cache with a newer version: notice, no refresh', () => {
    writeCache({ checkedAt: Date.now(), latestVersion: '2.0.0' });
    const { notice, refresh } = checkForUpdate('1.0.0');
    expect(notice).toContain('1.0.0 → 2.0.0');
    expect(refresh).toBeUndefined();
  });

  it('fresh cache already up to date: no notice, no refresh', () => {
    writeCache({ checkedAt: Date.now(), latestVersion: '1.0.0' });
    const { notice, refresh } = checkForUpdate('1.0.0');
    expect(notice).toBeUndefined();
    expect(refresh).toBeUndefined();
  });

  it('stale cache: keeps the notice from the stale data but also offers a refresh', () => {
    const eightHoursAndOneMinuteAgo = Date.now() - (8 * 60 + 1) * 60 * 1000;
    writeCache({
      checkedAt: eightHoursAndOneMinuteAgo,
      latestVersion: '2.0.0',
    });
    const { notice, refresh } = checkForUpdate('1.0.0');
    expect(notice).toContain('1.0.0 → 2.0.0');
    expect(refresh).toBeDefined();
  });

  it('refresh fetches the registry and rewrites the cache', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ version: '3.0.0' }),
      })),
    );
    const { refresh } = checkForUpdate('1.0.0');
    await refresh?.(new AbortController().signal);
    expect(readCache()?.latestVersion).toBe('3.0.0');
  });
});

describe('refreshLatestVersion', () => {
  it('returns the version from the registry response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ version: '4.5.6' }),
      })),
    );
    await expect(
      refreshLatestVersion(new AbortController().signal),
    ).resolves.toBe('4.5.6');
  });

  it('throws when the registry responds with a non-ok status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404 })),
    );
    await expect(
      refreshLatestVersion(new AbortController().signal),
    ).rejects.toThrow();
  });
});
