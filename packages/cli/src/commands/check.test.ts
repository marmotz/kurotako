import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
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
    outputs: [{ dir: './out' }],
  }
`;

let root: string;
let cwd: string;
let stderr: string;
let stderrSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  root = mkdtempSync(join(PKG_DIR, 'tmp-check-'));
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

describe('tako check', () => {
  it('an in-sync project exits 0 and says so', async () => {
    writeConfig(HAPPY_CONFIG);
    await runCli(['generate']);
    stderr = '';
    process.exitCode = undefined;

    await runCli(['check']);
    expect(process.exitCode ?? 0).toBe(0);
    expect(stderr).toContain('output is in sync');
  });

  it('a tampered generated file exits 1 and is listed as modified', async () => {
    writeConfig(HAPPY_CONFIG);
    await runCli(['generate']);
    writeFileSync(join(root, 'out', 'pg', 'zod', 'user.ts'), 'hacked\n');
    stderr = '';
    process.exitCode = undefined;

    await runCli(['check']);
    expect(process.exitCode).toBe(1);
    expect(stderr).toContain('drift detected');
    expect(stderr).toMatch(/modified\s+out\/pg\/zod\/user\.ts/);
    expect(stderr).toContain('Run `tako generate`.');
  });

  it('a removed generated file exits 1 and is listed as missing', async () => {
    writeConfig(HAPPY_CONFIG);
    await runCli(['generate']);
    rmSync(join(root, 'out', 'pg', 'zod', 'user.ts'));
    stderr = '';
    process.exitCode = undefined;

    await runCli(['check']);
    expect(process.exitCode).toBe(1);
    expect(stderr).toMatch(/missing\s+out\/pg\/zod\/user\.ts/);
  });

  it('an extra file under the output dir exits 1 as orphan', async () => {
    writeConfig(HAPPY_CONFIG);
    await runCli(['generate']);
    writeFileSync(join(root, 'out', 'pg', 'zod', 'stray.ts'), 'stray\n');
    stderr = '';
    process.exitCode = undefined;

    await runCli(['check']);
    expect(process.exitCode).toBe(1);
    expect(stderr).toMatch(/orphan\s+out\/pg\/zod\/stray\.ts/);
  });

  it('mode A with a non-existent output dir prints the single "does not exist" line, exit 1', async () => {
    writeConfig(HAPPY_CONFIG);
    await runCli(['check']);
    expect(process.exitCode).toBe(1);
    expect(stderr).toContain('output directory out does not exist');
    expect(stderr).not.toContain('missing');
  });

  it('an invalid schema exits 1 via renderError, not a drift report', async () => {
    writeConfig(`
      const parser = { name: 'p', parse: () => ({ namespace: 'pg', parser: 'p', entities: {}, enums: {} }) }
      const a = { name: 'a', dependsOn: ['b'], generate: () => ({ files: [], artifact: { entities: {} } }) }
      const b = { name: 'b', dependsOn: ['a'], generate: () => ({ files: [], artifact: { entities: {} } }) }
      export default { sources: { pg: { use: parser } }, generators: [{ use: a }, { use: b }], outputs: [{ dir: './out' }] }
    `);
    await runCli(['check']);
    expect(process.exitCode).toBe(1);
    expect(stderr).toContain('cycle:');
    expect(stderr).not.toContain('drift detected');
  });

  it('is read-only: an in-sync check writes nothing new', async () => {
    writeConfig(HAPPY_CONFIG);
    await runCli(['generate']);
    const before = readFileSync(
      join(root, 'out', 'pg', 'zod', 'user.ts'),
      'utf8',
    );
    await runCli(['check']);
    expect(
      readFileSync(join(root, 'out', 'pg', 'zod', 'user.ts'), 'utf8'),
    ).toBe(before);
    expect(existsSync(join(root, 'out', '.gitattributes'))).toBe(true);
  });
});
