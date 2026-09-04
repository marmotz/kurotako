import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PackageInstallError } from '../errors.js';
import { resolvePackageManager, runInstall } from './pm.js';

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'kurotako-pm-'));
  // A `.git` marker at the temp root stops the walk from escaping into the
  // real repo above os.tmpdir().
  await fs.writeFile(path.join(root, '.git'), '', 'utf8');
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('resolvePackageManager', () => {
  it('returns the configured manager verbatim, ignoring the filesystem', async () => {
    await fs.writeFile(path.join(root, 'yarn.lock'), '', 'utf8');
    expect(resolvePackageManager({ configured: 'pnpm', startDir: root })).toBe(
      'pnpm',
    );
  });

  it('detects a lockfile two directories up', async () => {
    const deep = path.join(root, 'a', 'b');
    await fs.mkdir(deep, { recursive: true });
    await fs.writeFile(path.join(root, 'bun.lockb'), '', 'utf8');
    expect(resolvePackageManager({ startDir: deep })).toBe('bun');
  });

  it('falls back to the packageManager field when no lockfile exists', async () => {
    await fs.writeFile(
      path.join(root, 'package.json'),
      JSON.stringify({ packageManager: 'pnpm@9.1.0' }),
      'utf8',
    );
    expect(resolvePackageManager({ startDir: root })).toBe('pnpm');
  });

  it('returns null and does not throw when nothing resolves', async () => {
    const deep = path.join(root, 'x');
    await fs.mkdir(deep, { recursive: true });
    expect(resolvePackageManager({ startDir: deep })).toBeNull();
  });
});

describe('runInstall', () => {
  it('wraps a non-zero exit in PackageInstallError', async () => {
    await expect(
      runInstall('npm', path.join(root, 'does-not-exist-anywhere')),
    ).rejects.toBeInstanceOf(PackageInstallError);
  });
});
