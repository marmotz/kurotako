import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { SourceIR } from '@kurotako/ir';
import { createSourceIR } from '@kurotako/ir';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { run } from './run.js';
import type { Generator, Parser, ResolvedConfig } from './types.js';
import { runInstall } from './writer/pm.js';

const build = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('tsup', () => ({ build }));
vi.mock('./writer/pm.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./writer/pm.js')>();
  return { ...actual, runInstall: vi.fn().mockResolvedValue(undefined) };
});

function sourceIR(namespace: string): SourceIR {
  return createSourceIR({ namespace, parser: 'fake' })
    .addEntity('User', (e) => {
      e.field('id', (f) => f.scalar('uuid').primary());
    })
    .build();
}

const parser: Parser = { name: 'fake', parse: () => sourceIR('pg') };
const generator: Generator = {
  name: 'zod',
  generate: () => ({
    files: [{ path: 'pg/zod/index.ts', content: '// zod\n' }],
    artifact: { entities: {}, peerDependencies: { zod: '^4' } },
  }),
};

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kurotako-runb-'));
  await fs.writeFile(path.join(dir, 'tsconfig.base.json'), '{}', 'utf8');
  await fs.writeFile(path.join(dir, 'tsup.config.base.ts'), '', 'utf8');
  const tsDir = path.join(dir, 'node_modules', 'typescript');
  await fs.mkdir(tsDir, { recursive: true });
  await fs.writeFile(
    path.join(tsDir, 'package.json'),
    '{"name":"typescript","main":"index.js"}',
    'utf8',
  );
  await fs.writeFile(path.join(tsDir, 'index.js'), '', 'utf8');
  build.mockClear();
  vi.mocked(runInstall).mockClear();
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

function config(): ResolvedConfig {
  return {
    rootDir: dir,
    sources: { pg: { parser } },
    generators: { zod: { generator } },
    output: {
      mode: 'package',
      packagesDir: path.join(dir, 'packages'),
      scope: '@kurotako',
      packageManager: 'bun',
    },
  };
}

describe('run (mode B)', () => {
  it('writes packages and afterEmit sees packagesDir + source paths', async () => {
    const afterEmit = vi.fn();
    await run({ ...config(), hooks: { afterEmit } });

    const pkgJson = path.join(dir, 'packages', 'kurotako-pg', 'package.json');
    expect(JSON.parse(await fs.readFile(pkgJson, 'utf8')).name).toBe(
      '@kurotako/pg',
    );
    expect(build).toHaveBeenCalledTimes(1);
    expect(vi.mocked(runInstall)).toHaveBeenCalledTimes(1);

    const ctx = afterEmit.mock.calls[0]?.[0] as {
      files: string[];
      outputDir: string;
    };
    expect(ctx.outputDir).toBe(path.join(dir, 'packages'));
    expect(
      ctx.files.some((f) => f.includes(`${path.sep}dist${path.sep}`)),
    ).toBe(false);
  });

  it('write: false spawns nothing', async () => {
    await run(config(), { write: false });
    expect(build).not.toHaveBeenCalled();
    expect(vi.mocked(runInstall)).not.toHaveBeenCalled();
  });
});
