import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConfigNotFoundError } from './errors.js';
import { resolveConfigFile } from './resolve.js';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'tako-resolve-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function touch(...segments: string[]) {
  const path = join(root, ...segments);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, '');
  return path;
}

describe('resolveConfigFile', () => {
  it('finds tako.config.ts in cwd', () => {
    const file = touch('tako.config.ts');
    expect(resolveConfigFile({ cwd: root })).toBe(file);
  });

  it('finds tako.config.ts two directories up', () => {
    const file = touch('tako.config.ts');
    const deep = join(root, 'a', 'b');
    mkdirSync(deep, { recursive: true });
    expect(resolveConfigFile({ cwd: deep })).toBe(file);
  });

  it('stops the walk at a .git directory (does not escape above it)', () => {
    touch('tako.config.ts'); // above the .git boundary
    const projectDir = join(root, 'project');
    mkdirSync(join(projectDir, '.git'), { recursive: true });
    const nested = join(projectDir, 'src');
    mkdirSync(nested, { recursive: true });
    expect(() => resolveConfigFile({ cwd: nested })).toThrow(
      ConfigNotFoundError,
    );
  });

  it('throws ConfigNotFoundError listing tried dirs when absent', () => {
    try {
      resolveConfigFile({ cwd: root });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigNotFoundError);
      expect((err as ConfigNotFoundError).triedPaths.length).toBeGreaterThan(0);
      expect((err as ConfigNotFoundError).message).toContain('tako.config.ts');
    }
  });

  it('honours an explicit --config path', () => {
    const file = touch('nested', 'custom.config.ts');
    expect(
      resolveConfigFile({ cwd: root, configPath: 'nested/custom.config.ts' }),
    ).toBe(file);
  });

  it('throws when the --config path is missing', () => {
    expect(() =>
      resolveConfigFile({ cwd: root, configPath: 'nope.config.ts' }),
    ).toThrow(ConfigNotFoundError);
  });

  it('throws when the --config path is not a .ts family file', () => {
    touch('tako.config.json');
    expect(() =>
      resolveConfigFile({ cwd: root, configPath: 'tako.config.json' }),
    ).toThrow(ConfigNotFoundError);
  });
});
