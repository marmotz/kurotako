/**
 * Background version check for the `tako` binary — compares the installed
 * `kurotako` version against the npm registry, cached for 8h so most
 * invocations do not hit the network.
 *
 * Design: `backlog/_archives/features/cli-self-update/technical.md` §Background version
 * check.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const REGISTRY_URL = 'https://registry.npmjs.org/kurotako/latest';
const TTL_MS = 8 * 60 * 60 * 1000;

export interface VersionCacheEntry {
  checkedAt: number;
  latestVersion: string;
}

export function getCacheFilePath(): string {
  const base = process.env.XDG_CACHE_HOME || join(homedir(), '.cache');
  return join(base, 'tako', 'version-check.json');
}

export function readCache(): VersionCacheEntry | undefined {
  try {
    const raw = readFileSync(getCacheFilePath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<VersionCacheEntry>;
    if (
      typeof parsed.checkedAt === 'number' &&
      typeof parsed.latestVersion === 'string'
    ) {
      return {
        checkedAt: parsed.checkedAt,
        latestVersion: parsed.latestVersion,
      };
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function writeCache(entry: VersionCacheEntry): void {
  const path = getCacheFilePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(entry));
}

export async function refreshLatestVersion(
  signal: AbortSignal,
): Promise<string> {
  const response = await fetch(REGISTRY_URL, { signal });
  if (!response.ok) {
    throw new Error(`registry request failed with status ${response.status}`);
  }
  const body = (await response.json()) as { version?: unknown };
  if (typeof body.version !== 'string') {
    throw new Error('registry response is missing a version string');
  }
  return body.version;
}

/**
 * `-1` when `a` is older than `b`, `0` when equal, `1` when newer. Handles
 * `major.minor.patch` plus an optional `-prerelease` suffix (a release always
 * outranks a prerelease of the same `major.minor.patch`).
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const [aMajor, aMinor, aPatch, aPre] = splitVersion(a);
  const [bMajor, bMinor, bPatch, bPre] = splitVersion(b);

  if (aMajor !== bMajor) {
    return aMajor < bMajor ? -1 : 1;
  }
  if (aMinor !== bMinor) {
    return aMinor < bMinor ? -1 : 1;
  }
  if (aPatch !== bPatch) {
    return aPatch < bPatch ? -1 : 1;
  }

  if (aPre === bPre) {
    return 0;
  }
  if (aPre === undefined) {
    return 1;
  }
  if (bPre === undefined) {
    return -1;
  }
  return aPre < bPre ? -1 : 1;
}

function splitVersion(
  version: string,
): [major: number, minor: number, patch: number, pre?: string] {
  const [core = '', ...rest] = version.split('-');
  const [major = 0, minor = 0, patch = 0] = core
    .split('.')
    .map((n) => Number.parseInt(n, 10) || 0);
  return [major, minor, patch, rest.length > 0 ? rest.join('-') : undefined];
}

export interface CheckForUpdateResult {
  notice?: string;
  refresh?: (signal: AbortSignal) => Promise<void>;
}

export function checkForUpdate(currentVersion: string): CheckForUpdateResult {
  const cache = readCache();
  const result: CheckForUpdateResult = {};

  if (cache && compareVersions(cache.latestVersion, currentVersion) > 0) {
    result.notice = `tako a new version of kurotako is available: ${currentVersion} → ${cache.latestVersion} (npm i kurotako@latest)`;
  }

  const isStale = cache === undefined || Date.now() - cache.checkedAt > TTL_MS;
  if (isStale) {
    result.refresh = async (signal: AbortSignal) => {
      const latestVersion = await refreshLatestVersion(signal);
      writeCache({ checkedAt: Date.now(), latestVersion });
    };
  }

  return result;
}
