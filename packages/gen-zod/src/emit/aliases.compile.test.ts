/**
 * Real-compiles the generator's emitted `aliases.ts` — the recursive `z.lazy`
 * chain of a self-referential alias, `z.union`, and `z.discriminatedUnion` over
 * two entity schemas — against a minimal `zod` `.d.ts` stub. Guards the
 * `z.ZodType<Name>` annotation that keeps a recursive alias from `TS7022`.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runGenerator } from '../testing/helpers.js';
import { geoSource, irOf } from '../testing/ir.js';
import { ZOD_DTS } from '../testing/zod-stub.js';

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gen-zod-compile-'));
  const zodDir = path.join(dir, 'node_modules', 'zod');
  await fs.mkdir(zodDir, { recursive: true });
  await fs.writeFile(
    path.join(zodDir, 'package.json'),
    JSON.stringify({ name: 'zod', version: '0.0.0', exports: './index.d.ts' }),
  );
  await fs.writeFile(path.join(zodDir, 'index.d.ts'), ZOD_DTS);
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

async function write(rel: string, content: string): Promise<void> {
  const full = path.join(dir, rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content, 'utf8');
}

describe('emitAliases output compiles against real Zod shapes', () => {
  it('recursive alias + discriminated union type-check', async () => {
    const out = runGenerator(irOf(geoSource()), { zodVersion: 4 });
    for (const file of out.files) {
      await write(file.path, file.content);
    }

    await write(
      'tsconfig.json',
      JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          lib: ['ES2023'],
          module: 'ESNext',
          moduleResolution: 'bundler',
          strict: true,
          noUncheckedIndexedAccess: true,
          verbatimModuleSyntax: true,
          noEmit: true,
          types: [],
        },
        include: ['geo'],
      }),
    );

    const configFile = ts.readConfigFile(
      path.join(dir, 'tsconfig.json'),
      ts.sys.readFile,
    );
    const parsed = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      dir,
    );
    const program = ts.createProgram({
      rootNames: parsed.fileNames,
      options: parsed.options,
    });
    // Scoped to the union-type surface this issue owns: `aliases.ts` and the
    // recursive `Group.schema.ts` (`child: ref('Shape')`). The where / select
    // blocks of the other entities lean on Zod methods the minimal stub omits.
    const diagnostics = ts.getPreEmitDiagnostics(program).filter((d) => {
      const f = d.file?.fileName ?? '';
      return (
        f.includes('/geo/zod/aliases.ts') ||
        f.includes('/geo/zod/Group.schema.ts')
      );
    });

    expect(
      ts.formatDiagnostics(diagnostics, {
        getCanonicalFileName: (f) => f,
        getCurrentDirectory: () => dir,
        getNewLine: () => '\n',
      }),
    ).toBe('');
  });
});
