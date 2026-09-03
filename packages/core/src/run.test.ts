import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { SourceIR } from '@kurotako/ir';
import { createSourceIR } from '@kurotako/ir';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DriverError } from './errors.js';
import { run } from './run.js';
import type {
  Generator,
  GeneratorArtifact,
  Parser,
  ResolvedConfig,
} from './types.js';

function source(namespace: string): SourceIR {
  return createSourceIR({ namespace, parser: 'fake' })
    .addEntity('User', (e) => {
      e.field('id', (f) => f.scalar('uuid').primary());
    })
    .build();
}

function parser(namespace: string): Parser {
  return { name: `parser-${namespace}`, parse: () => source(namespace) };
}

function generator(
  name: string,
  opts?: {
    dependsOn?: string[];
    optionalDependsOn?: string[];
    onGenerate?: (deps: Record<string, GeneratorArtifact>) => void;
    throws?: boolean;
  },
): Generator {
  return {
    name,
    dependsOn: opts?.dependsOn,
    optionalDependsOn: opts?.optionalDependsOn,
    generate: ({ dependencies }) => {
      if (opts?.throws) {
        throw new Error('kaboom');
      }
      opts?.onGenerate?.(dependencies);
      return {
        files: [{ path: `pg/${name}/index.ts`, content: `// ${name}\n` }],
        artifact: { entities: {} },
      };
    },
  };
}

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kurotako-run-'));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

function config(overrides: Partial<ResolvedConfig>): ResolvedConfig {
  return {
    rootDir: dir,
    sources: { pg: { parser: parser('pg') } },
    generators: { zod: { generator: generator('zod') } },
    output: { dir },
    ...overrides,
  };
}

describe('run', () => {
  it('write: false produces a full RunResult and touches no disk', async () => {
    const result = await run(config({}), { write: false });
    expect(result.order).toEqual(['zod']);
    expect(result.files.map((f) => f.path)).toEqual(['pg/zod/index.ts']);
    expect(result.ir.sources.pg).toBeDefined();
    expect(result.artifacts.zod).toBeDefined();
    expect(await fs.readdir(dir)).toEqual([]);
  });

  it('a real run writes the tree, then afterEmit fires once with written paths', async () => {
    const afterEmit = vi.fn();
    await run(config({ hooks: { afterEmit } }));
    expect(await fs.readFile(path.join(dir, 'pg/zod/index.ts'), 'utf8')).toBe(
      '// zod\n',
    );
    expect(afterEmit).toHaveBeenCalledTimes(1);
    const ctx = afterEmit.mock.calls[0]?.[0] as {
      files: string[];
      outputDir: string;
    };
    expect(ctx.files).toContain(path.join(dir, 'pg/zod/index.ts'));
    expect(ctx.outputDir).toBe(dir);
  });

  it('a generator throw becomes a DriverError naming it', async () => {
    const cfg = config({
      generators: { zod: { generator: generator('zod', { throws: true }) } },
    });
    await expect(run(cfg, { write: false })).rejects.toMatchObject({
      code: 'driver_error',
      role: 'generator',
      driverName: 'zod',
    });
    await expect(run(cfg, { write: false })).rejects.toBeInstanceOf(
      DriverError,
    );
  });

  it('a parser throw becomes a DriverError naming it and its namespace', async () => {
    const cfg = config({
      sources: {
        pg: {
          parser: {
            name: 'prisma',
            parse: () => {
              throw new Error('schema not found');
            },
          },
        },
      },
    });
    await expect(run(cfg, { write: false })).rejects.toMatchObject({
      code: 'driver_error',
      role: 'parser',
      driverName: 'prisma',
      namespace: 'pg',
    });
    await expect(run(cfg, { write: false })).rejects.toBeInstanceOf(
      DriverError,
    );
  });

  it('dependencies holds only declared, present deps', async () => {
    const seen: Record<string, string[]> = {};
    const cfg = config({
      generators: {
        zod: { generator: generator('zod') },
        angular: {
          generator: generator('angular', {
            dependsOn: ['zod'],
            optionalDependsOn: ['prisma-dmmf'],
            onGenerate: (deps) => {
              seen.angular = Object.keys(deps);
            },
          }),
        },
      },
    });
    const result = await run(cfg, { write: false });
    expect(result.order).toEqual(['zod', 'angular']);
    expect(seen.angular).toEqual(['zod']);
  });

  it('rejects before parsing when opts.signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    let parsed = false;
    const cfg = config({
      sources: {
        pg: {
          parser: {
            name: 'p',
            parse: () => {
              parsed = true;
              return source('pg');
            },
          },
        },
      },
    });
    await expect(run(cfg, { signal: controller.signal })).rejects.toThrow();
    expect(parsed).toBe(false);
  });
});
