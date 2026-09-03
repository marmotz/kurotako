import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCli } from '../cli.js';

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
    output: { dir: './out' },
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
    expect(stderr).toContain('wrote 1 files -> out');
  });

  it('--dry-run writes nothing and says so, exit 0', async () => {
    writeConfig(HAPPY_CONFIG);
    await runCli(['generate', '--dry-run']);
    expect(process.exitCode ?? 0).toBe(0);
    expect(existsSync(join(root, 'out'))).toBe(false);
    expect(stderr).toContain('1 files would be written');
  });

  it('a throwing driver exits 1 and renderError names the driver', async () => {
    writeConfig(`
      const parser = { name: 'p', parse: () => { throw new Error('kaboom') } }
      export default { sources: { pg: { use: parser } }, generators: [] }
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
      export default { sources: { pg: { use: parser } }, generators: [{ use: a }, { use: b }], output: { dir: './out' } }
    `);
    await runCli(['validate']);
    expect(process.exitCode).toBe(1);
    expect(stderr).toContain('cycle:');
    expect(existsSync(join(root, 'out'))).toBe(false);
  });
});
