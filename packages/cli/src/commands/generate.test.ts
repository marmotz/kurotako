import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { OutputConfig, ResolvedConfig } from '@kurotako/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCli } from '../cli.js';
import { outputSummaryDir } from './generate.js';

const ROOT_CONFIG: ResolvedConfig = {
  rootDir: '/root',
  sources: {},
  generators: {},
  outputs: [],
};

describe('outputSummaryDir', () => {
  it("mode 'dir' (default) -> output.dir, falling back to rootDir", () => {
    expect(outputSummaryDir({ dir: '/root/out' }, ROOT_CONFIG)).toBe(
      '/root/out',
    );
    expect(outputSummaryDir({}, ROOT_CONFIG)).toBe('/root');
  });

  it("mode 'package' -> output.packagesDir, not the unrelated dir default", () => {
    const output: OutputConfig = {
      mode: 'package',
      dir: '/root/generated/kurotako',
      packagesDir: '/root/packages',
      scope: '@acme',
    };
    expect(outputSummaryDir(output, ROOT_CONFIG)).toBe('/root/packages');
  });

  it("mode 'package' with no packagesDir -> falls back to rootDir", () => {
    expect(outputSummaryDir({ mode: 'package' }, ROOT_CONFIG)).toBe('/root');
  });
});

const PKG_DIR = join(import.meta.dirname, '..', '..');

const HAPPY_CONFIG = `
  const parser = { name: 'p', parse: () => ({ namespace: 'pg', parser: 'p', entities: {}, enums: {} }) }
  const gen = {
    name: 'zod',
    generate: () => ({
      files: [{ path: 'pg/zod/user.ts', content: 'export const x = 1\\n' }],
      artifact: { entities: {} },
    }),
  }
  export default {
    sources: { pg: { use: parser } },
    generators: [{ use: gen }],
    outputs: [{ dir: './out' }],
  }
`;

let root: string;
let cwd: string;
let stderr: string;
let stderrSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  root = mkdtempSync(join(PKG_DIR, 'tmp-gen-'));
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
});

afterEach(() => {
  process.chdir(cwd);
  rmSync(root, { recursive: true, force: true });
  stderrSpy.mockRestore();
  process.exitCode = undefined;
});

function writeConfig(source: string): void {
  writeFileSync(join(root, 'tako.config.ts'), source);
}

describe('tako generate', () => {
  it('happy path: writes files, exit 0, summary line', async () => {
    writeConfig(HAPPY_CONFIG);
    await runCli(['generate']);
    expect(process.exitCode ?? 0).toBe(0);
    expect(existsSync(join(root, 'out', 'pg', 'zod', 'user.ts'))).toBe(true);
    expect(stderr).toContain('wrote 2 files -> out');
  });

  it('--dry-run writes nothing and says so, exit 0', async () => {
    writeConfig(HAPPY_CONFIG);
    await runCli(['generate', '--dry-run']);
    expect(process.exitCode ?? 0).toBe(0);
    expect(existsSync(join(root, 'out'))).toBe(false);
    expect(stderr).toContain('2 files would be written');
  });

  it('a throwing driver exits 1 and renderError names the driver', async () => {
    writeConfig(`
      const parser = { name: 'p', parse: () => { throw new Error('kaboom') } }
      export default { sources: { pg: { use: parser } }, generators: [], outputs: [{ dir: './out' }] }
    `);
    await runCli(['generate']);
    expect(process.exitCode).toBe(1);
    expect(stderr).toContain('parser: p');
  });

  it('a missing tako.config.ts exits 1 with config_not_found', async () => {
    await runCli(['generate']);
    expect(process.exitCode).toBe(1);
    expect(stderr).toContain('config_not_found');
  });
});

describe('tako validate', () => {
  it('a valid project exits 0 and writes nothing', async () => {
    writeConfig(HAPPY_CONFIG);
    await runCli(['validate']);
    expect(process.exitCode ?? 0).toBe(0);
    expect(stderr).toContain('config and schema are valid');
    expect(existsSync(join(root, 'out'))).toBe(false);
  });

  it('a generator DAG cycle exits 1 with the cycle path, writes nothing', async () => {
    writeConfig(`
      const parser = { name: 'p', parse: () => ({ namespace: 'pg', parser: 'p', entities: {}, enums: {} }) }
      const a = { name: 'a', dependsOn: ['b'], generate: () => ({ files: [], artifact: { entities: {} } }) }
      const b = { name: 'b', dependsOn: ['a'], generate: () => ({ files: [], artifact: { entities: {} } }) }
      export default { sources: { pg: { use: parser } }, generators: [{ use: a }, { use: b }], outputs: [{ dir: './out' }] }
    `);
    await runCli(['validate']);
    expect(process.exitCode).toBe(1);
    expect(stderr).toContain('cycle:');
    expect(existsSync(join(root, 'out'))).toBe(false);
  });
});
